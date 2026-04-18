"""Phase 4: generate a deployable Hugo site from translated chapters + glossary."""
from __future__ import annotations

import json
import re
import shutil
import sys
from pathlib import Path

BASE_DIR = Path(__file__).parent
TRANSLATED_DIR = BASE_DIR / "translated"
CHAPTERS_DIR = BASE_DIR / "chapters"
GLOSSARY_DIR = BASE_DIR / "glossary"
MANIFEST_PATH = CHAPTERS_DIR / "manifest.json"
GLOSSARY_PATH = GLOSSARY_DIR / "glossary.json"

HUGO_DIR = BASE_DIR / "hugo-site"
HUGO_CONTENT = HUGO_DIR / "content"
HUGO_CHAPTERS = HUGO_CONTENT / "chapters"
THEME_DIR = HUGO_DIR / "themes" / "col-theme"
LAYOUTS_DIR = THEME_DIR / "layouts" / "_default"
LAYOUTS_ROOT = THEME_DIR / "layouts"
STATIC_CSS_DIR = THEME_DIR / "static" / "css"


CONFIG_TOML = """baseURL = "https://phucam.tv/ngon-ngu-chua/"
languageCode = "vi"
defaultContentLanguage = "vi"
title = "Ngụ Ngôn Của Chúa"
theme = "col-theme"

[params]
  author = "Ellen G. White"
  translator = "Bản dịch AI - Biên tập: PhucAm.tv"
  description = "Ngụ Ngôn Của Chúa - Bản dịch tiếng Việt"
  bookTitle = "Ngụ Ngôn Của Chúa"
  originalTitle = "Christ's Object Lessons"

[menu]
  [[menu.main]]
    name = "Các Chương"
    url = "/chapters/"
    weight = 1
  [[menu.main]]
    name = "Bảng Thuật Ngữ"
    url = "/glossary/"
    weight = 2
"""

THEME_TOML = """name = "col-theme"
license = "MIT"
description = "Clean Vietnamese-friendly theme for Christ's Object Lessons"
min_version = "0.100.0"
"""

BASEOF_HTML = """<!DOCTYPE html>
<html lang="{{ .Site.LanguageCode | default "vi" }}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{ if .IsHome }}{{ .Site.Title }}{{ else }}{{ .Title }} · {{ .Site.Title }}{{ end }}</title>
  <meta name="description" content="{{ .Site.Params.description | default .Site.Title }}">
  <link rel="stylesheet" href="{{ "css/main.css" | relURL }}">
</head>
<body>
  <header class="site-header">
    <div class="container">
      <a class="brand" href="{{ "/" | relURL }}">{{ .Site.Params.bookTitle | default .Site.Title }}</a>
      <nav class="main-nav">
        {{ range .Site.Menus.main }}
          <a href="{{ .URL | relURL }}">{{ .Name }}</a>
        {{ end }}
      </nav>
    </div>
  </header>
  <main class="container">
    {{ block "main" . }}{{ end }}
  </main>
  <footer class="site-footer">
    <div class="container">
      <p class="muted">
        {{ .Site.Params.originalTitle }} — {{ .Site.Params.author }}<br>
        {{ .Site.Params.translator }}
      </p>
    </div>
  </footer>
</body>
</html>
"""

SINGLE_HTML = """{{ define "main" }}
<article class="chapter">
  <header class="chapter-header">
    {{ if .Params.chapter }}<p class="muted">Chương {{ .Params.chapter }}</p>{{ end }}
    <h1>{{ .Title }}</h1>
    {{ with .Params.original_title }}<p class="original muted">Nguyên tác: {{ . }}</p>{{ end }}
  </header>

  <div class="chapter-body">
    {{ .Content }}
  </div>

  <nav class="chapter-nav">
    {{ with .PrevInSection }}
      <a class="nav-prev" href="{{ .RelPermalink }}">&larr; {{ .Title }}</a>
    {{ else }}
      <span></span>
    {{ end }}
    {{ with .NextInSection }}
      <a class="nav-next" href="{{ .RelPermalink }}">{{ .Title }} &rarr;</a>
    {{ else }}
      <span></span>
    {{ end }}
  </nav>
</article>
{{ end }}
"""

LIST_HTML = """{{ define "main" }}
<section class="chapter-list">
  <h1>{{ .Title }}</h1>
  {{ with .Content }}<div class="intro">{{ . }}</div>{{ end }}
  <ol class="chapters">
    {{ range .Pages.ByWeight }}
      <li>
        <a href="{{ .RelPermalink }}">
          <span class="ch-title">{{ .Title }}</span>
          {{ with .Params.original_title }}<span class="ch-original muted">{{ . }}</span>{{ end }}
        </a>
      </li>
    {{ end }}
  </ol>
</section>
{{ end }}
"""

INDEX_HTML = """{{ define "main" }}
<section class="book-intro">
  <h1>{{ .Site.Params.bookTitle | default .Site.Title }}</h1>
  <p class="original muted">{{ .Site.Params.originalTitle }} — {{ .Site.Params.author }}</p>
  {{ with .Content }}<div class="intro">{{ . }}</div>{{ end }}
</section>

<section class="chapter-list">
  <h2>Mục Lục</h2>
  <ol class="chapters">
    {{ range (where .Site.RegularPages "Section" "chapters").ByWeight }}
      <li>
        <a href="{{ .RelPermalink }}">
          <span class="ch-title">{{ .Title }}</span>
          {{ with .Params.original_title }}<span class="ch-original muted">{{ . }}</span>{{ end }}
        </a>
      </li>
    {{ end }}
  </ol>
</section>
{{ end }}
"""

MAIN_CSS = """:root {
  --bg: #faf9f7;
  --text: #2d2d2d;
  --muted: #8a8a8a;
  --border: #e5e1db;
  --accent: #6b4f2a;
  --link: #3a5a99;
  --link-hover: #1f3c78;
}

* { box-sizing: border-box; }

html, body { margin: 0; padding: 0; }

body {
  font-family: Georgia, "Times New Roman", serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.8;
  font-size: 18px;
}

.container {
  max-width: 720px;
  margin: 0 auto;
  padding: 0 1.25rem;
}

.site-header {
  border-bottom: 1px solid var(--border);
  padding: 1rem 0;
  background: #fff;
}

.site-header .container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.brand {
  font-weight: bold;
  font-size: 1.15rem;
  color: var(--accent);
  text-decoration: none;
}

.main-nav a {
  margin-left: 1rem;
  color: var(--text);
  text-decoration: none;
  font-size: 0.95rem;
}

.main-nav a:hover { color: var(--link-hover); }

main.container { padding-top: 2rem; padding-bottom: 4rem; }

.muted { color: var(--muted); font-size: 0.92rem; }

.chapter-header { margin-bottom: 2rem; text-align: center; }
.chapter-header h1 {
  font-size: 2rem;
  margin: 0.3rem 0 0.6rem;
  line-height: 1.3;
}
.chapter-header .original { font-style: italic; }

.chapter-body p {
  margin: 0 0 1.1rem;
  text-align: justify;
  hyphens: auto;
}

.chapter-body h1,
.chapter-body h2,
.chapter-body h3 {
  margin-top: 2rem;
  line-height: 1.35;
}

.chapter-body blockquote {
  border-left: 3px solid var(--accent);
  margin: 1.2rem 0;
  padding: 0.1rem 1rem;
  color: #4a4a4a;
  font-style: italic;
}

.chapter-body a { color: var(--link); }
.chapter-body a:hover { color: var(--link-hover); }

.chapter-nav {
  margin-top: 3rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.95rem;
}

.chapter-nav a {
  display: inline-block;
  padding: 0.55rem 0.9rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: #fff;
  color: var(--text);
  text-decoration: none;
  max-width: 48%;
}

.chapter-nav a:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.chapter-list h1,
.book-intro h1 {
  font-size: 1.9rem;
  margin-bottom: 0.4rem;
}

.chapter-list ol.chapters,
.book-intro + .chapter-list ol.chapters {
  list-style: none;
  padding: 0;
  margin: 1.2rem 0 0;
}

ol.chapters li {
  border-bottom: 1px solid var(--border);
  padding: 0.6rem 0;
}

ol.chapters li a {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  text-decoration: none;
  color: var(--text);
}

ol.chapters li a:hover .ch-title { color: var(--accent); }

.ch-original { flex-shrink: 0; font-style: italic; }

table.glossary {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0 2rem;
  font-size: 0.97rem;
}
table.glossary th, table.glossary td {
  border-bottom: 1px solid var(--border);
  text-align: left;
  padding: 0.5rem 0.6rem;
  vertical-align: top;
}
table.glossary th {
  background: #f0ebe2;
  font-weight: bold;
}

.site-footer {
  border-top: 1px solid var(--border);
  padding: 1.5rem 0;
  margin-top: 3rem;
  color: var(--muted);
  font-size: 0.88rem;
  text-align: center;
}

@media (max-width: 540px) {
  body { font-size: 17px; }
  .chapter-header h1 { font-size: 1.6rem; }
  .chapter-nav { flex-direction: column; }
  .chapter-nav a { max-width: 100%; }
  ol.chapters li a { flex-direction: column; gap: 0.2rem; }
}
"""


FRONT_MATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)


def parse_front_matter(md: str) -> tuple[dict, str]:
    m = FRONT_MATTER_RE.match(md)
    if not m:
        return {}, md
    fm_text = m.group(1)
    body = md[m.end():]
    fm: dict = {}
    for line in fm_text.splitlines():
        if ":" not in line:
            continue
        k, _, v = line.partition(":")
        v = v.strip()
        if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
            v = v[1:-1]
        fm[k.strip()] = v
    return fm, body


def _esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"')


def load_manifest() -> list[dict]:
    return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))


def load_glossary() -> list[dict]:
    return json.loads(GLOSSARY_PATH.read_text(encoding="utf-8"))


def sort_key_for_entry(entry: dict) -> tuple[int, str]:
    m = re.match(r"ch(\d+)(.*)", entry["id"])
    if not m:
        return (999, entry["id"])
    return (int(m.group(1)), m.group(2))


def generate_chapters(manifest: list[dict]) -> int:
    HUGO_CHAPTERS.mkdir(parents=True, exist_ok=True)
    # Clean out any stale previous outputs
    for old in HUGO_CHAPTERS.glob("*.md"):
        old.unlink()

    ordered = sorted(manifest, key=sort_key_for_entry)
    written = 0
    weight = 10
    for entry in ordered:
        src = TRANSLATED_DIR / f"{entry['id']}.md"
        if not src.exists():
            print(f"  (skipped {entry['id']}: no translation yet)")
            continue
        md = src.read_text(encoding="utf-8")
        fm, body = parse_front_matter(md)
        title = fm.get("title") or entry["title"]
        original_title = fm.get("original_title") or entry["title"]
        chapter_no = fm.get("chapter") or (re.sub(r"\D", "", entry["id"]) or "0")

        new_fm_lines = [
            "---",
            f'title: "{_esc(title)}"',
            f"weight: {weight}",
            f"chapter: {chapter_no}",
            f'original_title: "{_esc(original_title)}"',
            f'slug: "{entry["id"]}"',
            "draft: false",
            "---",
            "",
        ]
        out = HUGO_CHAPTERS / f"{entry['id']}.md"
        out.write_text("\n".join(new_fm_lines) + body.lstrip("\n"), encoding="utf-8")
        weight += 10
        written += 1
    return written


def generate_index(manifest: list[dict]) -> None:
    HUGO_CONTENT.mkdir(parents=True, exist_ok=True)
    body = (
        '---\n'
        'title: "Ngụ Ngôn Của Chúa"\n'
        '---\n\n'
        'Chào mừng bạn đến với bản dịch tiếng Việt của "Christ\'s Object Lessons" '
        "— *Ngụ Ngôn Của Chúa* — bởi Ellen G. White.\n\n"
        "Sách này khám phá những ngụ ngôn của Đức Chúa Giê-su, mỗi chương soi sáng "
        "một chân lý thuộc linh khác nhau cho đời sống Cơ-đốc.\n"
    )
    (HUGO_CONTENT / "_index.md").write_text(body, encoding="utf-8")

    ordered = sorted(manifest, key=sort_key_for_entry)
    list_front = (
        '---\n'
        'title: "Các Chương"\n'
        '---\n\n'
        f"Toàn bộ {len(ordered)} chương của sách *Ngụ Ngôn Của Chúa*.\n"
    )
    (HUGO_CHAPTERS / "_index.md").write_text(list_front, encoding="utf-8")


def generate_glossary(glossary: list[dict]) -> None:
    by_cat: dict[str, list[dict]] = {}
    for t in glossary:
        by_cat.setdefault(t["category"], []).append(t)

    cat_labels = {
        "theology": "Thần Học",
        "proper_noun": "Danh Từ Riêng",
        "parable_title": "Tên Ngụ Ngôn",
        "ellen_white_idiom": "Thành Ngữ Ellen G. White",
    }

    lines = [
        "---",
        'title: "Bảng Thuật Ngữ"',
        "---",
        "",
        "Các thuật ngữ và danh từ riêng được dùng nhất quán trong bản dịch này.",
        "",
    ]
    for cat in sorted(by_cat, key=lambda c: cat_labels.get(c, c)):
        label = cat_labels.get(cat, cat.replace("_", " ").title())
        lines.append(f"## {label}")
        lines.append("")
        lines.append('<table class="glossary">')
        lines.append("  <thead><tr><th>Tiếng Việt</th><th>Tiếng Anh</th><th>Ghi chú</th></tr></thead>")
        lines.append("  <tbody>")
        for t in sorted(by_cat[cat], key=lambda x: x["vi"].lower()):
            note = t.get("note") or ""
            vi = t["vi"].replace("<", "&lt;").replace(">", "&gt;")
            en = t["en"].replace("<", "&lt;").replace(">", "&gt;")
            note = note.replace("<", "&lt;").replace(">", "&gt;")
            lines.append(f"    <tr><td>{vi}</td><td>{en}</td><td>{note}</td></tr>")
        lines.append("  </tbody>")
        lines.append("</table>")
        lines.append("")

    (HUGO_CONTENT / "glossary.md").write_text("\n".join(lines), encoding="utf-8")


def write_theme() -> None:
    LAYOUTS_DIR.mkdir(parents=True, exist_ok=True)
    LAYOUTS_ROOT.mkdir(parents=True, exist_ok=True)
    STATIC_CSS_DIR.mkdir(parents=True, exist_ok=True)

    (THEME_DIR / "theme.toml").write_text(THEME_TOML, encoding="utf-8")
    (LAYOUTS_DIR / "baseof.html").write_text(BASEOF_HTML, encoding="utf-8")
    (LAYOUTS_DIR / "single.html").write_text(SINGLE_HTML, encoding="utf-8")
    (LAYOUTS_DIR / "list.html").write_text(LIST_HTML, encoding="utf-8")
    (LAYOUTS_ROOT / "index.html").write_text(INDEX_HTML, encoding="utf-8")
    (STATIC_CSS_DIR / "main.css").write_text(MAIN_CSS, encoding="utf-8")


def write_config() -> None:
    HUGO_DIR.mkdir(parents=True, exist_ok=True)
    (HUGO_DIR / "config.toml").write_text(CONFIG_TOML, encoding="utf-8")


def main() -> int:
    if not MANIFEST_PATH.exists():
        raise SystemExit("manifest.json missing; run phase 1 first")
    if not GLOSSARY_PATH.exists():
        raise SystemExit("glossary.json missing; run phase 2 first")

    manifest = load_manifest()
    glossary = load_glossary()

    write_config()
    write_theme()
    count = generate_chapters(manifest)
    generate_index(manifest)
    generate_glossary(glossary)

    print(f"Hugo site generated at {HUGO_DIR}")
    print(f"  - {count} chapter pages")
    print(f"  - {len(glossary)} glossary entries")
    print("  - theme: col-theme")
    print("\nRun:  cd col-translator/hugo-site && hugo server")
    return 0


if __name__ == "__main__":
    sys.exit(main())
