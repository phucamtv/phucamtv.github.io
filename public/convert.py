#!/usr/bin/env python3
"""Convert Notion JSON page backups to Markdown files."""

import json
import os
import re
from pathlib import Path
from urllib.parse import urlparse, parse_qs

INPUT_DIR = Path("output/pages")
OUTPUT_DIR = Path("articles")
AUTHORS_FILE = Path("output/authors.json")


NOTION_ID_TO_PERMALINK = {}


def build_page_id_map():
    """Build a mapping from Notion page ID (no hyphens) to permalink."""
    for filename in sorted(INPUT_DIR.iterdir()):
        if not filename.suffix == ".json":
            continue
        page_data = json.loads(filename.read_text(encoding="utf-8"))
        page_id = page_data.get("id", "").replace("-", "")
        rt = page_data.get("properties", {}).get("Permalink", {}).get("rich_text", [])
        permalink = rt[0]["plain_text"] if rt else ""
        if page_id and permalink:
            NOTION_ID_TO_PERMALINK[page_id] = permalink


def resolve_notion_href(href):
    """Resolve a Notion page URL to its permalink if known."""
    if not href or "notion.so/" not in href:
        return href
    # Extract the page ID from the URL (last path segment, possibly after a slug)
    path = urlparse(href).path.strip("/")
    # The ID is the last 32 hex chars (no hyphens)
    page_id = path.split("/")[-1].split("-")[-1] if "/" in path else path
    # Handle URLs like /Page-Title-abc123def456...
    if len(page_id) != 32:
        # Try extracting last 32 hex chars from the path segment
        segment = path.split("/")[-1]
        if len(segment) >= 32:
            candidate = segment[-32:]
            if all(c in "0123456789abcdef" for c in candidate):
                page_id = candidate
    return NOTION_ID_TO_PERMALINK.get(page_id, href)


def rich_text_to_md(rich_text_list):
    """Convert Notion rich_text array to markdown string."""
    parts = []
    for rt in rich_text_list:
        text = rt["plain_text"]
        if not text:
            continue
        ann = rt["annotations"]
        href = rt.get("href")

        if ann["code"]:
            text = f"`{text}`"
        if ann["bold"]:
            text = f"**{text}**"
        if ann["italic"]:
            text = f"*{text}*"
        if ann["strikethrough"]:
            text = f"~~{text}~~"
        if ann["underline"]:
            text = f"<u>{text}</u>"
        if href:
            resolved = resolve_notion_href(href)
            text = f"[{text}]({resolved})"

        parts.append(text)
    return "".join(parts)


def extract_youtube_id(url):
    """Extract YouTube video ID from URL."""
    parsed = urlparse(url)
    if "youtube.com" in parsed.netloc:
        return parse_qs(parsed.query).get("v", [None])[0]
    if "youtu.be" in parsed.netloc:
        return parsed.path.lstrip("/")
    return None


def blocks_to_md(blocks, indent=0):
    """Convert Notion blocks to markdown lines."""
    lines = []
    numbered_counter = 0

    for block in blocks:
        btype = block["type"]
        content = block[btype]
        prefix = "  " * indent

        if btype == "table_of_contents":
            continue

        if btype == "paragraph":
            text = rich_text_to_md(content.get("rich_text", []))
            lines.append(f"{prefix}{text}")
            lines.append("")
            numbered_counter = 0

        elif btype == "heading_2":
            text = rich_text_to_md(content.get("rich_text", []))
            lines.append(f"{prefix}## {text}")
            lines.append("")
            numbered_counter = 0

        elif btype == "heading_3":
            text = rich_text_to_md(content.get("rich_text", []))
            lines.append(f"{prefix}### {text}")
            lines.append("")
            numbered_counter = 0

        elif btype == "quote":
            text = rich_text_to_md(content.get("rich_text", []))
            for line in text.split("\n"):
                lines.append(f"{prefix}> {line}")
            lines.append("")
            numbered_counter = 0

        elif btype == "callout":
            icon = content.get("icon", {})
            emoji = icon.get("emoji", "") if icon.get("type") == "emoji" else ""
            text = rich_text_to_md(content.get("rich_text", []))
            prefix_icon = f"{emoji} " if emoji else ""
            for i, line in enumerate(text.split("\n")):
                if i == 0:
                    lines.append(f"{prefix}> {prefix_icon}{line}")
                else:
                    lines.append(f"{prefix}> {line}")
            lines.append("")
            numbered_counter = 0

        elif btype == "bulleted_list_item":
            text = rich_text_to_md(content.get("rich_text", []))
            lines.append(f"{prefix}- {text}")
            if "children" in block:
                lines.extend(blocks_to_md(block["children"], indent + 1))
            numbered_counter = 0

        elif btype == "numbered_list_item":
            numbered_counter += 1
            text = rich_text_to_md(content.get("rich_text", []))
            lines.append(f"{prefix}{numbered_counter}. {text}")
            if "children" in block:
                lines.extend(blocks_to_md(block["children"], indent + 1))

        elif btype == "divider":
            lines.append(f"{prefix}---")
            lines.append("")
            numbered_counter = 0

        elif btype == "video":
            vtype = content.get("type", "")
            url = ""
            if vtype == "external":
                url = content["external"]["url"]
            elif vtype == "file":
                url = content["file"]["url"]

            yt_id = extract_youtube_id(url) if url else None
            if yt_id:
                lines.append(f'{prefix}{{{{< youtube "{yt_id}" >}}}}')
            elif url:
                lines.append(f"{prefix}{url}")
            lines.append("")
            numbered_counter = 0

        elif btype == "table":
            if "children" in block:
                rows = block["children"]
                for ri, row in enumerate(rows):
                    cells = row["table_row"]["cells"]
                    cell_texts = [
                        rich_text_to_md(cell) if cell else "" for cell in cells
                    ]
                    lines.append(f"{prefix}| {' | '.join(cell_texts)} |")
                    if ri == 0:
                        lines.append(
                            f"{prefix}| {' | '.join('---' for _ in cells)} |"
                        )
                lines.append("")
            numbered_counter = 0

        else:
            # Unknown block type — skip
            numbered_counter = 0

    return lines


def get_author_name(author_page):
    """Extract name from an author page."""
    props = author_page.get("properties", {})
    # Try "Name" title property first
    name_prop = props.get("Name", {})
    if name_prop.get("title"):
        return "".join(t["plain_text"] for t in name_prop["title"])
    # Fallback to any title-type property
    for prop in props.values():
        if prop.get("type") == "title" and prop.get("title"):
            return "".join(t["plain_text"] for t in prop["title"])
    return ""


def convert_page(page_data, authors=None):
    """Convert a single page JSON to markdown string."""
    if authors is None:
        authors = {}
    props = page_data["properties"]

    # Title
    title = page_data.get("title", "")

    # Date
    date = props["Date"]["date"]["start"] if props["Date"]["date"] else ""

    # Tags
    tags = [t["name"] for t in props["Tags"]["multi_select"]]

    # Permalink
    rt = props["Permalink"]["rich_text"]
    permalink = rt[0]["plain_text"] if rt else ""

    # Authors
    author_relations = props.get("Author", {}).get("relation", [])
    if isinstance(author_relations, dict):
        author_relations = [author_relations]
    author_ids = []
    for rel in author_relations:
        aid = rel.get("id", "")
        if aid and aid in authors:
            author_ids.append(aid)

    # Flags
    unpublished = props["Unpublished"]["checkbox"]
    part_of_series = props["Part of series"]["checkbox"]

    # Notion ID
    notion_id = page_data["id"]

    # Block content
    body_lines = blocks_to_md(page_data.get("blocks", []))
    body = "\n".join(body_lines).strip()

    # Extract YouTube IDs from body
    youtube_ids = re.findall(r'{{<\s*youtube\s+(?:id=)?"([^"]+)"', body)

    # Frontmatter
    tags_str = json.dumps(tags, ensure_ascii=False)
    authors_str = json.dumps(author_ids, ensure_ascii=False)
    # Use single quotes for title if it contains double quotes
    if '"' in title:
        title_line = f"title: '{title}'"
    else:
        title_line = f'title: "{title}"'

    fm_lines = [
        "---",
        title_line,
        f"date: {date}",
        f"tags: {tags_str}",
        f"authors: {authors_str}",
    ]
    if youtube_ids:
        fm_lines.append("plugins: [youtube]")
        fm_lines.append(f"youtubeIDs: {json.dumps(youtube_ids, ensure_ascii=False)}")
    fm_lines.extend([
        f"url: {permalink}",
        f"draft: {str(unpublished).lower()}",
        f"part_of_series: {str(part_of_series).lower()}",
        f"notion_id: {notion_id}",
        "---",
    ])
    fm = "\n".join(fm_lines)

    return fm + "\n\n" + body + "\n", date, permalink


def main():
    # Build page ID → permalink map for resolving internal links
    build_page_id_map()
    print(f"Built page ID map with {len(NOTION_ID_TO_PERMALINK)} entries")

    # Load authors if available
    authors = {}
    if AUTHORS_FILE.exists():
        authors = json.loads(AUTHORS_FILE.read_text(encoding="utf-8"))
        print(f"Loaded {len(authors)} authors from {AUTHORS_FILE}")

    count = 0
    for filename in sorted(INPUT_DIR.iterdir()):
        if not filename.suffix == ".json":
            continue

        page_data = json.loads(filename.read_text(encoding="utf-8"))
        md_content, date, permalink = convert_page(page_data, authors)

        if not date:
            print(f"SKIP (no date): {page_data.get('title', filename.name)}")
            continue

        # Build output path: articles/YYYY/MM/DD/slug--parts--joined.md
        year, month, day = date.split("-")
        # Strip leading / and trailing /index.html
        slug_path = permalink.strip("/")
        if slug_path.endswith("/index.html"):
            slug_path = slug_path[: -len("/index.html")]
        elif slug_path.endswith(".html"):
            slug_path = slug_path[: -len(".html")]
        # Flatten path segments with --
        slug_flat = slug_path.replace("/", "--")

        out_path = OUTPUT_DIR / year / month / day / f"{slug_flat}.md"
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(md_content, encoding="utf-8")
        count += 1

    print(f"Converted {count} pages to {OUTPUT_DIR}/")


if __name__ == "__main__":
    main()
