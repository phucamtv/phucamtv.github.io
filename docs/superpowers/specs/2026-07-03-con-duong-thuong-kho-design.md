# Con Đường Thương Khó — 3D Via Dolorosa Design

**Date:** 2026-07-03

## Goal

A single, self-contained HTML page presenting a 3D walk along the *Via
Dolorosa* — the Way of the Cross of Đức Chúa Giê-su — as a guided, paced
devotional experience through the 14 Scriptural Stations of the Cross.

## Experience

- **Guided rail, user-paced.** The camera moves on an invisible spline down
  the center of an ancient Jerusalem street. The user does not free-roam;
  they control the *pace* along a fixed route.
- **14 station-stops** are fixed points along the rail. At each stop the
  camera settles, looking forward, and a devotional panel fades in.
- **Controls:**
  - `↓` / `Space` — advance to the next station
  - `↑` — go back to the previous station
  - `←` / `→` — gently pan the head to look around at the current stop
    (bounded; cannot leave the rail)
  - On-screen tap buttons (`◄ ● ►`) mirror the keys for touch/mobile.
- **Framing cards:** a "Bắt đầu" intro card before Station 1, and a closing
  card after Station 14 ("Ngài đã sống lại" + return-to-start).

## Art Direction

- **Literal ancient sandstone street.** A long corridor built from
  procedural geometry: cobblestone ground, walls on both sides with arches
  and door recesses, occasional steps.
- **Palette:** warm sandstone walls (~#c9a876) with darker shadow tones
  (~#8a6d4a), cobblestone ground, a dusk sky-gradient fog.
- **Lighting:** warm ambient + one low-angle golden directional light
  casting long shadows down the street — evening / Passover mood. One
  shadow-casting light only, for performance.
- **Golgotha:** the street opens at the far end onto a dark hill. The cross
  silhouette grows visible as stations progress, fully framed around
  Stations 10–13; the sealed tomb appears at Station 14.
- **Motion:** camera tweens between stops with easing (no hard cuts), plus a
  subtle idle bob. Fog + limited draw distance keep it atmospheric and fast.

## Content — 14 Scriptural Stations

All content in Vietnamese, following site terminology ("Đức Chúa Giê-su",
"Đức Chúa Trời", "Giê-ru-sa-lem", etc.). Each station is one data object:

```
{ số, tựa, câu: { tham_chiếu, trích }, suy_niệm }
```

The Scriptural Stations of the Cross (every station grounded in the Gospel
text):

1. Ghết-sê-ma-nê — Đức Chúa Giê-su cầu nguyện
2. Bị Giu-đa phản bội và bị bắt
3. Bị Tòa Công Luận kết án
4. Bị Phi-e-rơ chối
5. Bị Phi-lát xét xử
6. Bị đánh đòn và đội mão gai
7. Vác thập tự giá
8. Si-môn người Sy-ren vác giúp thập tự giá
9. Gặp các phụ nữ thành Giê-ru-sa-lem
10. Bị đóng đinh trên thập tự giá
11. Hứa với kẻ trộm biết ăn năn
12. Trối Mẹ mình cho môn đồ
13. Trút hơi thở cuối cùng
14. Được an táng trong mộ

Each station panel shows: station number + progress ("Chặng N / 14"),
Vietnamese title, Scripture quote with reference, and one meditation line.
Panels cross-fade on navigation (old fades out, camera glides, new fades in).

## Architecture

Single full-screen `<canvas>` Three.js scene + an HTML overlay layer for
station text and controls. Three cooperating parts:

1. **Street builder** — procedural geometry (boxes, instanced cobblestones)
   for ground, walls, arches, steps, and Golgotha at the far end.
2. **Station data + panel renderer** — the 14-object array and the DOM
   overlay that fades panels in/out.
3. **Rail controller** — the camera spline, the 14 stop positions, tweened
   easing between stops, bounded look-around, and the input handlers
   (keyboard + touch buttons).

## Integration

- **File:** `static/con-duong-thuong-kho/index.html`, served at
  `/con-duong-thuong-kho/`.
- **Self-contained.** Everything inline (HTML, CSS, JS, station data,
  geometry). The single external dependency is **Three.js from a CDN**,
  loaded via `<script type="importmap">` + an ES module.
- **Relative paths only** — no absolute phucam.tv URLs (per project rule).
- **No Hugo front matter / layout** — a leaf experience in `static/`, copied
  verbatim. Not wired into any menu unless requested later.

## Testing / Success Criteria

- Loads with no console errors (CDN reachable).
- All 14 stations reachable forward *and* backward; camera cannot leave the
  rail.
- Works with both keyboard and on-screen touch buttons.
- Vietnamese diacritics and site terminology render correctly.
- Smooth on a laptop (targets ~60fps); degrades gracefully on mobile.

## Out of Scope

- No downloaded image/audio assets (procedural only).
- No menu/nav wiring.
- No audio narration or background music (could be a later addition).
- No multiplayer, saving, or analytics.
