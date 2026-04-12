/**
 * Inject VN1925 Nguyen Thi audio frontmatter into all Bible book pages.
 *
 * Maps playlist video index → book file slug:
 *   1-39  → ot01-ot39
 *   40-56 → nt01-nt17
 *   (nt18 = Phi-lê-môn is unavailable in the playlist)
 *   57-65 → nt19-nt27
 */

const data = await Bun.file("data/yt/kt/data/vn1925-nguyen-thi.json").json();
const videos: { index: number; videoId: string; title: string }[] = data.videos;

// Build slug → videoId mapping
const slugToVideo = new Map<string, string>();

for (const v of videos) {
  const idx = v.index;
  let slug: string;

  if (idx <= 39) {
    // OT: index 1 → ot01, index 39 → ot39
    slug = `ot${String(idx).padStart(2, "0")}`;
  } else {
    // NT: index 40 → nt01, but skip nt18 (Phi-lê-môn, unavailable)
    const ntNum = idx - 39; // 40→1, 41→2, ..., 56→17
    if (ntNum <= 17) {
      slug = `nt${String(ntNum).padStart(2, "0")}`;
    } else {
      // 57→nt19, 58→nt20, ..., 65→nt27
      // ntNum would be 18,19,...,26 but we need nt19,nt20,...,nt27
      slug = `nt${String(ntNum + 1).padStart(2, "0")}`;
    }
  }

  slugToVideo.set(slug, v.videoId);
}

console.log(`Mapped ${slugToVideo.size} videos to book slugs`);

// Audio YAML block to inject
function audioYaml(videoId: string): string {
  return `audio:
  - type: youtube-video
    id: ${videoId}
    lang: vi
    translation: VN1925
    voiceGender: male
    scope: book`;
}

// Process each book file
const bookDir = "content/kt";
let updated = 0;
let skipped = 0;

for (const slug of [...Array(39)].map((_, i) => `ot${String(i + 1).padStart(2, "0")}`)
  .concat([...Array(27)].map((_, i) => `nt${String(i + 1).padStart(2, "0")}`))) {

  const filePath = `${bookDir}/${slug}.md`;
  const file = Bun.file(filePath);
  if (!(await file.exists())) {
    console.log(`SKIP ${slug}: file not found`);
    skipped++;
    continue;
  }

  const videoId = slugToVideo.get(slug);
  if (!videoId) {
    console.log(`SKIP ${slug}: no video in playlist (unavailable)`);
    skipped++;
    continue;
  }

  let content = await file.text();

  // Remove any existing audio block from frontmatter
  content = content.replace(/^(---\n[\s\S]*?)audio:\n(?:  [\s\S]*?)(?=\n---|\n\w+:)/m, "$1");

  // Insert audio block before the closing ---
  const closingIdx = content.indexOf("\n---", 4); // skip opening ---
  if (closingIdx === -1) {
    console.log(`SKIP ${slug}: no closing frontmatter delimiter`);
    skipped++;
    continue;
  }

  const before = content.slice(0, closingIdx);
  const after = content.slice(closingIdx);

  content = before + "\n" + audioYaml(videoId) + after;

  await Bun.write(filePath, content);
  updated++;
}

console.log(`\nDone: ${updated} updated, ${skipped} skipped`);
