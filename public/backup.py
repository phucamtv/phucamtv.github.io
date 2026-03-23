#!/usr/bin/env python3
"""Backup Notion database pages (properties + block content) to JSON and download images."""

import json
import os
import time
import urllib.request
import urllib.error
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.environ["NOTION_API_KEY"]
DATABASE_ID = "98b3d6b9c642429592307f4209a425e2"
BASE_URL = "https://api.notion.com/v1"
HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json",
}
OUTPUT_DIR = Path("output")
PHOTOS_DIR = OUTPUT_DIR / "photos"


def api_request(method, url, data=None):
    """Make a Notion API request with retry on rate limit."""
    for attempt in range(5):
        req = urllib.request.Request(url, method=method, headers=HEADERS)
        if data:
            req.data = json.dumps(data).encode()
        try:
            with urllib.request.urlopen(req) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = float(e.headers.get("Retry-After", 2))
                print(f"  Rate limited, waiting {wait}s...")
                time.sleep(wait)
                continue
            raise
    raise RuntimeError(f"Failed after retries: {url}")


def query_database():
    """Fetch all pages from the database with pagination."""
    pages = []
    start_cursor = None
    while True:
        body = {"page_size": 100}
        if start_cursor:
            body["start_cursor"] = start_cursor
        result = api_request("POST", f"{BASE_URL}/databases/{DATABASE_ID}/query", body)
        pages.extend(result["results"])
        print(f"  Fetched {len(pages)} pages so far...")
        if not result.get("has_more"):
            break
        start_cursor = result["next_cursor"]
    return pages


def get_blocks(page_id):
    """Recursively fetch all blocks for a page."""
    blocks = []
    start_cursor = None
    while True:
        url = f"{BASE_URL}/blocks/{page_id}/children?page_size=100"
        if start_cursor:
            url += f"&start_cursor={start_cursor}"
        result = api_request("GET", url)
        for block in result["results"]:
            blocks.append(block)
            if block.get("has_children"):
                block["children"] = get_blocks(block["id"])
        if not result.get("has_more"):
            break
        start_cursor = result["next_cursor"]
    return blocks


def extract_images(blocks, page_id):
    """Extract image URLs from blocks."""
    images = []
    for block in blocks:
        if block["type"] == "image":
            img = block["image"]
            if img["type"] == "file":
                images.append({"url": img["file"]["url"], "block_id": block["id"]})
            elif img["type"] == "external":
                images.append({"url": img["external"]["url"], "block_id": block["id"]})
        if "children" in block:
            images.extend(extract_images(block["children"], page_id))
    return images


def download_image(url, filepath):
    """Download an image file."""
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=30) as resp:
            with open(filepath, "wb") as f:
                f.write(resp.read())
        return True
    except Exception as e:
        print(f"  Failed to download {url}: {e}")
        return False


def get_page_title(page):
    """Extract title from page properties."""
    title_prop = page["properties"].get("Name", {})
    if title_prop.get("title"):
        return "".join(t["plain_text"] for t in title_prop["title"])
    return page["id"]


def fetch_author_pages(pages):
    """Collect unique author relation IDs and fetch their page data from Notion."""
    author_ids = set()
    for page in pages:
        relations = page["properties"].get("Author", {}).get("relation", [])
        if isinstance(relations, dict):
            relations = [relations]
        for rel in relations:
            aid = rel.get("id", "")
            if aid:
                author_ids.add(aid)

    authors = {}
    print(f"\nFetching {len(author_ids)} author pages...")
    for i, aid in enumerate(sorted(author_ids)):
        print(f"  [{i+1}/{len(author_ids)}] {aid}")
        try:
            page_data = api_request("GET", f"{BASE_URL}/pages/{aid}")
            authors[aid] = page_data
        except Exception as e:
            print(f"  Failed to fetch author {aid}: {e}")
    return authors


def main():
    OUTPUT_DIR.mkdir(exist_ok=True)
    PHOTOS_DIR.mkdir(exist_ok=True)

    print("Querying database...")
    pages = query_database()
    print(f"Total pages: {len(pages)}")

    # Fetch author pages
    authors = fetch_author_pages(pages)
    authors_file = OUTPUT_DIR / "authors.json"
    with open(authors_file, "w", encoding="utf-8") as f:
        json.dump(authors, f, ensure_ascii=False, indent=2)
    print(f"Saved {len(authors)} authors to {authors_file}")

    all_data = []
    total_images = 0

    for i, page in enumerate(pages):
        title = get_page_title(page)
        page_id = page["id"]
        print(f"[{i+1}/{len(pages)}] {title[:60]}")

        # Fetch block content
        blocks = get_blocks(page_id)

        # Extract and download images
        images = extract_images(blocks, page_id)
        downloaded_images = []
        for img in images:
            ext = Path(img["url"].split("?")[0].split("/")[-1]).suffix or ".png"
            filename = f"{page_id}_{img['block_id']}{ext}"
            filepath = PHOTOS_DIR / filename
            if download_image(img["url"], filepath):
                downloaded_images.append({"block_id": img["block_id"], "file": str(filepath)})
                total_images += 1

        # Build page data
        page_data = {
            "id": page_id,
            "title": title,
            "created_time": page["created_time"],
            "last_edited_time": page["last_edited_time"],
            "properties": page["properties"],
            "blocks": blocks,
            "downloaded_images": downloaded_images,
            "url": page.get("url"),
        }
        all_data.append(page_data)

    # Write combined JSON
    output_file = OUTPUT_DIR / "notion_backup.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)

    print(f"\nDone! {len(pages)} pages saved to {output_file}")
    print(f"Downloaded {total_images} images to {PHOTOS_DIR}/")


if __name__ == "__main__":
    main()
