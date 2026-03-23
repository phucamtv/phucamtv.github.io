#!/usr/bin/env python3
"""Download author avatars and generate expanded authors.json for Hugo data."""

import json
import os
import urllib.request
from pathlib import Path

AUTHORS_SOURCE = Path("output/authors.json")
AUTHORS_OUTPUT = Path("../data/authors.json")
AVATARS_DIR = Path("../static/images/authors")


def main():
    data = json.loads(AUTHORS_SOURCE.read_text(encoding="utf-8"))
    AVATARS_DIR.mkdir(parents=True, exist_ok=True)

    authors = {}

    for uid, author in data.items():
        props = author["properties"]

        # Name
        name_titles = props.get("Name", {}).get("title", [])
        name = name_titles[0]["text"]["content"] if name_titles else ""

        # Email
        email = props.get("Email", {}).get("email") or ""

        # Phone
        phone_rt = props.get("Phone Number", {}).get("rich_text", [])
        phone = phone_rt[0]["text"]["content"] if phone_rt else ""

        # Country
        country_sel = props.get("Country", {}).get("select")
        country = country_sel["name"] if country_sel else ""

        # Avatar
        avatar_files = props.get("Avatar", {}).get("files", [])
        avatar_filename = ""
        if avatar_files:
            file_entry = avatar_files[0]
            original_name = file_entry.get("name", "avatar.jpg")
            ext = os.path.splitext(original_name)[1] or ".jpg"
            avatar_filename = f"{uid}{ext}"

            # Get URL (handle both "file" and "external" types)
            url = ""
            if file_entry.get("type") == "file":
                url = file_entry["file"]["url"]
            elif file_entry.get("type") == "external":
                url = file_entry["external"]["url"]

            if url:
                dest = AVATARS_DIR / avatar_filename
                if not dest.exists():
                    print(f"Downloading avatar for {name}...")
                    try:
                        urllib.request.urlretrieve(url, dest)
                    except Exception as e:
                        print(f"  Failed: {e}")
                        avatar_filename = ""
                else:
                    print(f"Avatar already exists for {name}")

        authors[uid] = {
            "name": name,
            "email": email,
            "phone": phone,
            "country": country,
            "avatar": avatar_filename,
        }

    AUTHORS_OUTPUT.write_text(
        json.dumps(authors, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"\nWrote {len(authors)} authors to {AUTHORS_OUTPUT}")


if __name__ == "__main__":
    main()
