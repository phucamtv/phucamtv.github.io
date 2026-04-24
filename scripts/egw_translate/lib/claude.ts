export interface ClaudeResult {
  ok: boolean;
  text?: string;
  error?: string;
}

export interface ClaudeOptions {
  systemPrompt: string;
  userText: string;
  model?: string; // e.g., "opus" or "sonnet"; defaults to "opus"
  timeoutMs?: number; // defaults to 600_000 (10 min)
  maxBudgetUsd?: number; // per-call cost cap; defaults to 1.0
}

const RETRY_ATTEMPTS = 3;

async function spawnOnce(opts: ClaudeOptions): Promise<ClaudeResult> {
  const model = opts.model ?? "opus";
  const timeoutMs = opts.timeoutMs ?? 600_000;
  const maxBudget = opts.maxBudgetUsd ?? 1.0;

  // Note on flags:
  // - We deliberately do NOT pass --bare. --bare disables OAuth/keychain auth and
  //   requires ANTHROPIC_API_KEY, which is not how this environment is authenticated
  //   (Claude.ai Max subscription via OAuth).
  // - --setting-sources "" skips loading user/project/local settings, which gives
  //   us most of the clean-batch hygiene we wanted from --bare.
  // - --system-prompt overrides CLAUDE.md auto-discovery per CLI help.
  // - --tools "" disables all built-in tools (text in, text out).
  const proc = Bun.spawn(
    [
      "claude",
      "-p",
      "--system-prompt",
      opts.systemPrompt,
      "--tools",
      "",
      "--model",
      model,
      "--max-budget-usd",
      String(maxBudget),
      "--permission-mode",
      "bypassPermissions",
      "--setting-sources",
      "",
    ],
    {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    },
  );

  proc.stdin.write(opts.userText);
  await proc.stdin.end();

  const timer = setTimeout(() => {
    try {
      proc.kill();
    } catch {}
  }, timeoutMs);

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  clearTimeout(timer);

  if (exitCode !== 0) {
    return {
      ok: false,
      error: `claude exit ${exitCode}: ${stderr.trim() || stdout.trim()}`,
    };
  }
  return { ok: true, text: stdout.trim() };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function callClaude(opts: ClaudeOptions): Promise<ClaudeResult> {
  let lastErr: string | undefined;
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    const result = await spawnOnce(opts);
    if (result.ok && result.text) return result;
    lastErr = result.error ?? "empty response";
    if (attempt < RETRY_ATTEMPTS) {
      await sleep(2 ** attempt * 1000);
    }
  }
  return { ok: false, error: lastErr };
}
