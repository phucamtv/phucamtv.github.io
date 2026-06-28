#!/usr/bin/env node
/*
 * verify-lib-nav.mjs — headless assertions for the library app-shell responsive
 * logic (rail / mid / bottom navbar) across the three bands. No LLM, no deps.
 *
 * What it does:
 *   1. `hugo` build to a temp dir (unless --url given)
 *   2. serves it on a local port (Node http, static)
 *   3. drives headless Chrome via CDP (raw WebSocket, zero deps)
 *   4. asserts the per-band invariants from CLAUDE.DESIGN-PRINCIPLES.md
 *   5. exits 0 if all pass, 1 on any failure
 *
 * Usage:
 *   node scripts/verify-lib-nav.mjs                # build + serve + verify
 *   node scripts/verify-lib-nav.mjs --url http://localhost:1313   # against a running server
 *   node scripts/verify-lib-nav.mjs --keep         # leave the build dir for inspection
 *
 * Requires: hugo on PATH, Google Chrome installed.
 */

import net from "net";
import http from "http";
import crypto from "crypto";
import { spawn, spawnSync } from "child_process";
import { createReadStream, existsSync, statSync, rmSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join, extname, normalize } from "path";
import { fileURLToPath } from "url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };

const CHROME =
  process.env.CHROME_BIN ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// The page under test must render the rail + navbar AND use the full multi-column
// grid (not a `no-mid` index). The home feed (/) does: rail | detail | info.
const TEST_PATH = "/";

// ---- expectations (kept in sync with nav-data.html: 7 top-level items) ----
const PRIMARY_ON_BAR = 4; // mobile shows first 4 top-level + "⋮"
const TOPLEVEL_TOTAL = 7;

const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".woff2": "font/woff2", ".ico": "image/x-icon",
};

// ───────────────────────── helpers ─────────────────────────

function log(s) { process.stdout.write(s + "\n"); }
const C = { green: (s) => `\x1b[32m${s}\x1b[0m`, red: (s) => `\x1b[31m${s}\x1b[0m`, dim: (s) => `\x1b[2m${s}\x1b[0m`, bold: (s) => `\x1b[1m${s}\x1b[0m` };

function buildSite() {
  const out = mkdtempSync(join(tmpdir(), "verify-lib-nav-"));
  log(C.dim(`• hugo build → ${out}`));
  const r = spawnSync(
    "hugo",
    ["--quiet", "--minify", "--baseURL", "http://localhost/", "--destination", out],
    { cwd: ROOT, stdio: ["ignore", "inherit", "inherit"] }
  );
  if (r.status !== 0) { throw new Error("hugo build failed"); }
  return out;
}

function serve(dir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = normalize(decodeURIComponent(req.url.split("?")[0]));
      let fp = join(dir, p);
      if (existsSync(fp) && statSync(fp).isDirectory()) fp = join(fp, "index.html");
      if (!existsSync(fp)) { res.statusCode = 404; return res.end("404"); }
      res.setHeader("content-type", MIME[extname(fp)] || "application/octet-stream");
      createReadStream(fp).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

// minimal CDP client over a raw WebSocket (no `ws` dep)
function cdp(wsUrl) {
  return new Promise((resolve, reject) => {
    const u = new URL(wsUrl);
    const key = crypto.randomBytes(16).toString("base64");
    const sock = net.connect(+u.port, u.hostname);
    const to = setTimeout(() => { sock.destroy(); reject(new Error("CDP connect timeout")); }, 15000);
    let up = false, buf = Buffer.alloc(0), id = 0;
    const waiters = new Map();
    sock.on("connect", () =>
      sock.write(
        `GET ${u.pathname} HTTP/1.1\r\nHost: ${u.host}\r\nUpgrade: websocket\r\n` +
        `Connection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`
      )
    );
    const send = (method, params = {}) =>
      new Promise((res, rej) => {
        const mid = ++id;
        waiters.set(mid, { res, rej });
        const j = Buffer.from(JSON.stringify({ id: mid, method, params }));
        const mask = crypto.randomBytes(4);
        const pl = Buffer.from(j);
        for (let i = 0; i < pl.length; i++) pl[i] ^= mask[i % 4];
        const L = pl.length;
        let hdr;
        if (L < 126) hdr = Buffer.from([0x81, 0x80 | L]);
        else if (L < 65536) hdr = Buffer.from([0x81, 0xfe, L >> 8, L & 255]);
        else hdr = Buffer.from([0x81, 0xff, 0, 0, 0, 0, (L >> 24) & 255, (L >> 16) & 255, (L >> 8) & 255, L & 255]);
        sock.write(Buffer.concat([hdr, mask, pl]));
      });
    sock.on("data", (d) => {
      buf = Buffer.concat([buf, d]);
      if (!up) {
        const i = buf.indexOf("\r\n\r\n");
        if (i < 0) return;
        up = true;
        buf = buf.slice(i + 4);
        clearTimeout(to);
        resolve({ send, close: () => sock.destroy() });
      }
      while (buf.length >= 2) {
        const opcode = buf[0] & 0x0f;
        let L = buf[1] & 0x7f, off = 2;
        if (L === 126) { L = buf.readUInt16BE(2); off = 4; }
        else if (L === 127) { L = Number(buf.readBigUInt64BE(2)); off = 10; }
        if (buf.length < off + L) return;
        const payload = buf.slice(off, off + L);
        buf = buf.slice(off + L);
        if (opcode === 0x8) { sock.destroy(); return; } // close
        if (opcode !== 0x1) continue;
        let msg;
        try { msg = JSON.parse(payload.toString()); } catch { continue; }
        if (msg.id && waiters.has(msg.id)) {
          const { res, rej } = waiters.get(msg.id);
          waiters.delete(msg.id);
          msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
        }
      }
    });
    sock.on("error", (e) => { clearTimeout(to); reject(e); });
  });
}

function launchChrome(port) {
  const child = spawn(
    CHROME,
    [
      "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
      `--remote-debugging-port=${port}`, "--remote-allow-origins=*",
      "--user-data-dir=" + mkdtempSync(join(tmpdir(), "verify-chrome-")),
      "about:blank",
    ],
    { stdio: "ignore" }
  );
  return child;
}

function httpJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (r) => { let d = ""; r.on("data", (c) => (d += c)); r.on("end", () => resolve(JSON.parse(d))); }).on("error", reject);
  });
}

async function waitFor(fn, ms = 8000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try { return await fn(); } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 150));
  }
  return await fn();
}

// ───────────────────────── assertions ─────────────────────────

// Probe expression run in-page. Returns a JSON blob describing the shell state.
// `setColorScheme` / device metrics are applied via CDP before this runs.
const PROBE = `(() => {
  const vis = (el) => !!el && getComputedStyle(el).display !== 'none' &&
    getComputedStyle(el).visibility !== 'hidden' && el.getClientRects().length > 0;
  const onscreen = (el) => { if (!el) return false; const r = el.getBoundingClientRect();
    return r.right <= window.innerWidth + 1 && r.left >= -1; };
  const rail = document.querySelector('.lib-rail');
  const navbar = document.querySelector('.lib-navbar');
  const more = document.querySelector('.lib-navbar-more');
  const inner = document.querySelector('.lib-navbar-inner');
  const railVisible = vis(rail);
  const navbarVisible = vis(navbar);
  // Visible top-level slots on the bar = direct children of inner that are
  // currently shown and are not the "⋮" More button. (On iPad the is-overflow
  // items are visible inline; on mobile they're hidden — vis() handles both.)
  const slots = inner ? [...inner.children].filter((e) =>
    !e.classList.contains('lib-navbar-more')) : [];
  const barSlots = slots.filter(vis).length;
  return JSON.stringify({
    vw: window.innerWidth,
    railVisible, navbarVisible,
    moreVisible: vis(more),
    barSlots,
    navRight: navbar ? Math.round(navbar.getBoundingClientRect().right) : null,
    navWithinViewport: navbar ? navbar.getBoundingClientRect().right <= window.innerWidth + 1 : null,
    gridCols: getComputedStyle(document.querySelector('.lib-app')).gridTemplateColumns.split(' ').length,
  });
})()`;

// subrow probe: open Kinh Thánh (or ⋮) then report back-pill + items
const OPEN_SUBROW = (sel) => `(() => {
  const b = document.querySelector('.lib-navbar ${sel}');
  if (!b) return JSON.stringify({ err: 'trigger not found' });
  b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  const back = document.querySelector('.lib-navbar-back');
  const items = document.querySelectorAll('.lib-navbar-subrow-items .lib-navbar-item');
  const cs = back ? getComputedStyle(back) : null;
  const bg = cs ? cs.backgroundColor : null;
  const r = back ? back.getBoundingClientRect() : null;
  return JSON.stringify({
    open: document.querySelector('.lib-navbar').classList.contains('subrow-open'),
    backVisible: !!back && cs.display !== 'none' && r.width > 0,
    backHasFill: bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent',
    backOnscreen: r ? (r.left >= 0 && r.right <= window.innerWidth + 1) : false,
    itemCount: items.length,
  });
})()`;

let PASS = 0, FAIL = 0;
function check(name, cond, detail) {
  if (cond) { PASS++; log("  " + C.green("✓") + " " + name); }
  else { FAIL++; log("  " + C.red("✗") + " " + name + (detail ? C.dim("  → " + detail) : "")); }
}

async function evalJson(page, expr) {
  const r = await page.send("Runtime.evaluate", { expression: expr, returnByValue: true });
  return JSON.parse(r.result.value);
}

// Connect to one page target, configure the band, navigate, return a page handle.
// One CDP connection per band keeps state fully isolated (no leakage between bands).
async function band(dbgPort, target, { width, height, dark = false }) {
  // each Chrome debug session exposes the open page target under /json
  const tabs = await waitFor(() => httpJson(`http://127.0.0.1:${dbgPort}/json`));
  const pageTab = tabs.find((t) => t.type === "page");
  const page = await cdp(pageTab.webSocketDebuggerUrl);
  await page.send("Page.enable");
  await page.send("Runtime.enable");
  if (dark) await page.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] });
  await page.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width <= 960 });
  await page.send("Page.navigate", { url: target });
  await new Promise((r) => setTimeout(r, 800)); // settle + app-js bind
  return page;
}

// ───────────────────────── main ─────────────────────────

async function main() {
  let buildDir = null, server = null, chrome = null;
  const url = opt("--url");
  let base;
  try {
    if (url) {
      base = url.replace(/\/$/, "");
      log(C.dim(`• using ${base}`));
    } else {
      buildDir = buildSite();
      const s = await serve(buildDir);
      server = s.server;
      base = `http://127.0.0.1:${s.port}`;
      log(C.dim(`• serving on ${base}`));
    }
    const target = base + TEST_PATH;

    const dbgPort = 9222 + Math.floor(Math.random() * 800);
    chrome = launchChrome(dbgPort);
    await waitFor(() => httpJson(`http://127.0.0.1:${dbgPort}/json/version`));

    log("");
    log(C.bold("Library nav — responsive band checks"));

    // ---------- Desktop (≥1161) ----------
    log("\n" + C.bold("Desktop @1280") + C.dim("  (rail visible, no navbar, 3 columns)"));
    {
      const p = await band(dbgPort, target, { width: 1280, height: 860 });
      const s = await evalJson(p, PROBE);
      check("rail is visible", s.railVisible, JSON.stringify(s));
      check("navbar is hidden", !s.navbarVisible);
      check("grid has 3 columns", s.gridCols === 3, "cols=" + s.gridCols);
      p.close();
    }

    // ---------- iPad band (961–1160) ----------
    log("\n" + C.bold("iPad @1080") + C.dim("  (rail hidden, navbar inline, no ⋮, all items)"));
    {
      const p = await band(dbgPort, target, { width: 1080, height: 820 });
      const s = await evalJson(p, PROBE);
      check("rail is hidden", !s.railVisible);
      check("navbar is visible", s.navbarVisible);
      check("⋮ More is hidden", !s.moreVisible);
      check(`all ${TOPLEVEL_TOTAL} items inline`, s.barSlots === TOPLEVEL_TOTAL, "slots=" + s.barSlots);
      p.close();
    }

    // ---------- Mobile (≤960) ----------
    log("\n" + C.bold("Mobile @390") + C.dim("  (rail hidden, navbar 4+⋮, fits viewport)"));
    {
      const p = await band(dbgPort, target, { width: 390, height: 844 });
      const s = await evalJson(p, PROBE);
      check("rail is hidden", !s.railVisible);
      check("navbar is visible", s.navbarVisible);
      check("⋮ More is visible", s.moreVisible);
      check(`${PRIMARY_ON_BAR} primary items on bar`, s.barSlots === PRIMARY_ON_BAR, "slots=" + s.barSlots);
      check("navbar fits the viewport (⋮ reachable)", s.navWithinViewport === true, "navRight=" + s.navRight + " vw=" + s.vw);

      // subrow via Kinh Thánh parent
      const kt = await evalJson(p, OPEN_SUBROW('[data-sheet=".lib-navbar-kids-track"]'));
      check("Kinh Thánh opens a subrow", kt.open === true, JSON.stringify(kt));
      check("subrow has the 2 children", kt.itemCount === 2, "count=" + kt.itemCount);
      check("back pill is visible", kt.backVisible === true, JSON.stringify(kt));
      check("back pill has a background fill", kt.backHasFill === true, JSON.stringify(kt));
      check("back pill is on-screen", kt.backOnscreen === true, JSON.stringify(kt));
      p.close();
    }

    // ---------- Mobile dark mode (back-pill contrast) ----------
    log("\n" + C.bold("Mobile @390 dark") + C.dim("  (back pill themed + filled)"));
    {
      const p = await band(dbgPort, target, { width: 390, height: 844, dark: true });
      const more = await evalJson(p, OPEN_SUBROW(".lib-navbar-more"));
      check("⋮ opens the overflow subrow", more.open === true, JSON.stringify(more));
      check(`overflow subrow has ${TOPLEVEL_TOTAL - PRIMARY_ON_BAR} items`,
        more.itemCount === TOPLEVEL_TOTAL - PRIMARY_ON_BAR, "count=" + more.itemCount);
      check("back pill has a fill in dark mode", more.backHasFill === true, JSON.stringify(more));
      p.close();
    }
  } finally {
    try { chrome && chrome.kill(); } catch {}
    try { server && server.close(); } catch {}
    if (buildDir && !flag("--keep")) { try { rmSync(buildDir, { recursive: true, force: true }); } catch {} }
    else if (buildDir) log(C.dim(`• kept build dir: ${buildDir}`));
  }

  log("");
  if (FAIL === 0) { log(C.green(C.bold(`All ${PASS} checks passed.`))); process.exit(0); }
  else { log(C.red(C.bold(`${FAIL} failed`)) + C.dim(`, ${PASS} passed.`)); process.exit(1); }
}

main().catch((e) => { log(C.red("ERROR: " + (e.stack || e.message))); process.exit(2); });
