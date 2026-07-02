# Con Đường Thương Khó — 3D Via Dolorosa Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single self-contained HTML page presenting a 3D, guided-rail, user-paced walk along the Via Dolorosa (Con Đường Thương Khó) through the 14 Scriptural Stations of the Cross.

**Architecture:** One full-screen Three.js `<canvas>` scene plus an HTML overlay for station text and controls. Procedural sandstone-street geometry, a camera rail with 14 tweened stop positions, and a 14-object station-data array driving a cross-fading DOM panel. Everything inline in one file; the only external dependency is Three.js from a CDN via importmap.

**Tech Stack:** HTML + CSS + vanilla ES-module JavaScript, Three.js (CDN, importmap), no build step (Hugo `static/` copies the file verbatim).

## Global Constraints

- All UI/content text in Vietnamese, following site terminology: "Đức Chúa Giê-su" (never "Chúa Giê-su"/"Jesus"/"Giê-xu"), "Đức Chúa Trời", "Giê-ru-sa-lem", "Đức Thánh Linh", "Kinh Thánh". Capitalize divine names correctly.
- Use "…" (not "..."), and a space after every comma.
- **Relative paths only** — never hard-code the `phucam.tv` domain.
- Single file: `static/con-duong-thuong-kho/index.html`. Everything inline (HTML/CSS/JS/data/geometry). Only external resource permitted: Three.js from a CDN.
- No Hugo front matter, no layout, no menu wiring.
- No downloaded image/audio assets — all geometry procedural.
- Verification is **manual in a browser** (no test runner exists for a standalone Three.js page in this repo). Each task ends by opening the file and confirming visible behavior + an empty console.

**Three.js pin (use verbatim in the importmap for every task):**

```html
<script type="importmap">
{
  "imports": {
    "three": "https://unpkg.com/three@0.160.0/build/three.module.js"
  }
}
</script>
```

**Local serving command (used in every verification step):**

```bash
# From repo root. Serves static/ so the ES module + importmap load correctly.
cd /Users/htruong/code/phucamtv/static && python3 -m http.server 8099
# Then open: http://localhost:8099/con-duong-thuong-kho/
```

Open the browser DevTools Console for every verification; "empty console" means no errors or warnings from our code.

---

### Task 1: Page skeleton, canvas, and a rendering Three.js scene

Establishes the file, the importmap, a full-screen resizable canvas, and a minimal scene (sky-color background + fog + one light) that renders. Proves Three.js loads from the CDN and the render loop runs.

**Files:**
- Create: `static/con-duong-thuong-kho/index.html`

**Interfaces:**
- Consumes: nothing (first task).
- Produces (globals within the single module, relied on by later tasks):
  - `scene: THREE.Scene`
  - `camera: THREE.PerspectiveCamera`
  - `renderer: THREE.WebGLRenderer`
  - `clock: THREE.Clock`
  - `function animate()` — the `requestAnimationFrame` loop; later tasks add per-frame update calls inside it.
  - Constant colors: `SANDSTONE = 0xc9a876`, `SHADOW = 0x8a6d4a`, `SKY = 0xe8c9a0`.

- [ ] **Step 1: Create the file with skeleton, importmap, canvas, CSS, and a rendering scene**

Create `static/con-duong-thuong-kho/index.html`:

```html
<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Con Đường Thương Khó — Đức Chúa Giê-su</title>
<style>
  :root { color-scheme: dark; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { height: 100%; overflow: hidden; background: #1a1208; }
  body { font-family: -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif; }
  #scene { position: fixed; inset: 0; display: block; width: 100%; height: 100%; }
</style>
<script type="importmap">
{
  "imports": {
    "three": "https://unpkg.com/three@0.160.0/build/three.module.js"
  }
}
</script>
</head>
<body>
<canvas id="scene"></canvas>

<script type="module">
import * as THREE from 'three';

const SANDSTONE = 0xc9a876;
const SHADOW = 0x8a6d4a;
const SKY = 0xe8c9a0;

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 14, 55);

const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
camera.position.set(0, 1.7, 0);
camera.lookAt(0, 1.7, -10);

// Warm ambient + one low-angle golden directional light (dusk).
scene.add(new THREE.AmbientLight(0xffe9c8, 0.55));
const sun = new THREE.DirectionalLight(0xffd08a, 1.1);
sun.position.set(-8, 12, -6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 80;
sun.shadow.camera.left = -20;
sun.shadow.camera.right = 20;
sun.shadow.camera.top = 20;
sun.shadow.camera.bottom = -20;
scene.add(sun);

const clock = new THREE.Clock();

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();
</script>
</body>
</html>
```

- [ ] **Step 2: Serve and verify the scene renders**

Run:

```bash
cd /Users/htruong/code/phucamtv/static && python3 -m http.server 8099
```

Open `http://localhost:8099/con-duong-thuong-kho/` in a browser.
Expected: a full-window warm dusk-colored (sandy) background fills the screen, resizes with the window, and the DevTools Console is empty (no errors). Nothing else is visible yet (no geometry).

- [ ] **Step 3: Commit**

```bash
git add static/con-duong-thuong-kho/index.html
git commit -m "feat(via-dolorosa): page skeleton with rendering Three.js scene"
```

---

### Task 2: Procedural sandstone street (ground, walls, arches, Golgotha)

Builds the visible world: a long cobblestone corridor with sandstone walls, arch/door recesses, a couple of steps, and Golgotha (hill + cross + tomb) at the far end. This is the static set the camera will travel through.

**Files:**
- Modify: `static/con-duong-thuong-kho/index.html` (add a street-builder block before `animate()`)

**Interfaces:**
- Consumes: `scene`, `SANDSTONE`, `SHADOW` (from Task 1).
- Produces:
  - `const STREET_LENGTH = 140` — total street length in world units along −Z.
  - `const STREET_WIDTH = 6` — walkable width in world units.
  - `function buildStreet()` — adds all street/Golgotha meshes to `scene`; called once at load.

- [ ] **Step 1: Add street constants and the street builder**

Insert this block immediately **after** the `sun`/light setup and **before** `const clock = ...` in the module:

```javascript
const STREET_LENGTH = 140;
const STREET_WIDTH = 6;

function buildStreet() {
  // --- Ground: cobblestone strip running down -Z ---
  const groundGeo = new THREE.PlaneGeometry(STREET_WIDTH, STREET_LENGTH, 1, 1);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x9c8560, roughness: 1 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, -STREET_LENGTH / 2 + 2);
  ground.receiveShadow = true;
  scene.add(ground);

  // Instanced cobblestones for texture (subtle raised blocks).
  const cobbleGeo = new THREE.BoxGeometry(0.55, 0.08, 0.55);
  const cobbleMat = new THREE.MeshStandardMaterial({ color: 0x8a7350, roughness: 1 });
  const cols = 8, rows = 200;
  const cobbles = new THREE.InstancedMesh(cobbleGeo, cobbleMat, cols * rows);
  const m = new THREE.Matrix4();
  let ci = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = -STREET_WIDTH / 2 + 0.4 + c * 0.7 + (r % 2 ? 0.15 : 0);
      const z = 2 - r * 0.7;
      const y = 0.04 + Math.sin((r * 3 + c * 7)) * 0.01;
      m.makeTranslation(x, y, z);
      cobbles.setMatrixAt(ci++, m);
    }
  }
  cobbles.instanceMatrix.needsUpdate = true;
  cobbles.receiveShadow = true;
  scene.add(cobbles);

  // --- Walls on both sides, with periodic arch/door recesses ---
  const wallMat = new THREE.MeshStandardMaterial({ color: SANDSTONE, roughness: 0.95 });
  const shadowMat = new THREE.MeshStandardMaterial({ color: SHADOW, roughness: 1 });
  const segLen = 4;
  const nSegs = Math.floor((STREET_LENGTH - 8) / segLen);
  for (let side = -1; side <= 1; side += 2) {
    const xBase = side * (STREET_WIDTH / 2 + 0.5);
    for (let i = 0; i < nSegs; i++) {
      const z = 2 - i * segLen - segLen / 2;
      const isRecess = i % 3 === 1; // every 3rd segment is a door/arch recess
      const h = isRecess ? 4.2 : 5 + (i % 2) * 0.6;
      const geo = new THREE.BoxGeometry(1, h, segLen - 0.15);
      const wall = new THREE.Mesh(geo, isRecess ? shadowMat : wallMat);
      wall.position.set(xBase + (isRecess ? side * 0.35 : 0), h / 2, z);
      wall.castShadow = true;
      wall.receiveShadow = true;
      scene.add(wall);

      if (isRecess) {
        // Arch top over the recess.
        const arch = new THREE.Mesh(
          new THREE.CylinderGeometry(1.1, 1.1, 1, 12, 1, false, 0, Math.PI),
          wallMat
        );
        arch.rotation.z = Math.PI / 2;
        arch.rotation.y = Math.PI / 2;
        arch.scale.set(1, segLen - 0.6, 1);
        arch.position.set(xBase, 4.2, z);
        arch.castShadow = true;
        scene.add(arch);
      }
    }
  }

  // --- A couple of steps partway down ---
  for (let s = 0; s < 3; s++) {
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(STREET_WIDTH, 0.18, 0.9),
      wallMat
    );
    step.position.set(0, 0.09 + s * 0.18, -60 - s * 0.9);
    step.receiveShadow = true;
    step.castShadow = true;
    scene.add(step);
  }

  // --- Golgotha at the far end: dark hill + cross + tomb ---
  const hill = new THREE.Mesh(
    new THREE.SphereGeometry(18, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x4a3a28, roughness: 1 })
  );
  hill.position.set(0, -14, -STREET_LENGTH + 6);
  hill.receiveShadow = true;
  scene.add(hill);

  const crossMat = new THREE.MeshStandardMaterial({ color: 0x2e2318, roughness: 1 });
  const crossGroup = new THREE.Group();
  const vert = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 0.5), crossMat);
  vert.position.y = 3;
  const horiz = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 0.5), crossMat);
  horiz.position.y = 4.2;
  crossGroup.add(vert, horiz);
  crossGroup.position.set(0, 3.5, -STREET_LENGTH + 4);
  crossGroup.traverse(o => { o.castShadow = true; });
  scene.add(crossGroup);

  // Sealed tomb (a low doorway with a round stone) off to the side of the hill.
  const tomb = new THREE.Mesh(
    new THREE.BoxGeometry(4, 3, 3),
    new THREE.MeshStandardMaterial({ color: 0x5a4a34, roughness: 1 })
  );
  tomb.position.set(7, 1.5, -STREET_LENGTH + 8);
  tomb.castShadow = true;
  tomb.receiveShadow = true;
  scene.add(tomb);
  const stone = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.2, 0.5, 20),
    new THREE.MeshStandardMaterial({ color: 0x6b5a40, roughness: 1 })
  );
  stone.rotation.x = Math.PI / 2;
  stone.position.set(6, 1.2, -STREET_LENGTH + 6.6);
  stone.castShadow = true;
  scene.add(stone);
}

buildStreet();
```

- [ ] **Step 2: Serve and verify the street renders**

Run the serve command from Global Constraints, open the page.
Expected: looking down −Z, a cobbled street stretches ahead framed by warm sandstone walls with periodic shadowed arch recesses, long golden shadows cast across the ground, steps partway down, and a dark hill with a cross silhouette + a tomb far ahead fading into fog. Console empty.

- [ ] **Step 3: Commit**

```bash
git add static/con-duong-thuong-kho/index.html
git commit -m "feat(via-dolorosa): procedural sandstone street and Golgotha"
```

---

### Task 3: Station data (14 Scriptural Stations, Vietnamese)

Adds the content array. Pure data — no visible change yet, but Task 4/5 depend on its exact shape.

**Files:**
- Modify: `static/con-duong-thuong-kho/index.html` (add the `STATIONS` array)

**Interfaces:**
- Consumes: `STREET_LENGTH` (from Task 2).
- Produces:
  - `const STATIONS` — array of 14 objects, each:
    `{ so: number, tua: string, tham_chieu: string, trich: string, suy_niem: string, z: number }`
    where `z` is the world-Z position of that station's stop.

- [ ] **Step 1: Add the STATIONS array**

Insert after `buildStreet();`:

```javascript
// 14 Scriptural Stations. z positions are spread evenly down the street,
// stopping short of Golgotha so the final stations frame the cross/tomb.
const STATIONS = [
  { so: 1,  tua: "Ghết-sê-ma-nê — Đức Chúa Giê-su cầu nguyện",
    tham_chieu: "Ma-thi-ơ 26:39",
    trich: "Cha ơi! nếu có thể được, xin cho chén nầy lìa khỏi Con! Song không theo ý muốn Con, mà theo ý muốn Cha.",
    suy_niem: "Trong vườn tối, Ngài phó chính mình cho ý muốn Đức Chúa Trời." },
  { so: 2,  tua: "Đức Chúa Giê-su bị Giu-đa phản bội và bị bắt",
    tham_chieu: "Ma-thi-ơ 26:48-50",
    trich: "Bạn ơi! vậy thì vì việc nầy mà ngươi đến đây sao? Rồi chúng đến gần tra tay bắt Đức Chúa Giê-su.",
    suy_niem: "Một nụ hôn phản bội, nhưng Ngài vẫn gọi kẻ ấy là bạn." },
  { so: 3,  tua: "Đức Chúa Giê-su bị Tòa Công Luận kết án",
    tham_chieu: "Ma-thi-ơ 26:65-66",
    trich: "Nó đã nói phạm thượng… Chúng trả lời rằng: Nó đáng chết.",
    suy_niem: "Đấng vô tội đứng lặng nghe lời kết án bất công." },
  { so: 4,  tua: "Đức Chúa Giê-su bị Phi-e-rơ chối",
    tham_chieu: "Lu-ca 22:61-62",
    trich: "Chúa xây mặt lại ngó Phi-e-rơ… Rồi người đi ra ngoài, khóc lóc thảm thiết.",
    suy_niem: "Ánh mắt của Chúa không lên án, mà kêu gọi ăn năn." },
  { so: 5,  tua: "Đức Chúa Giê-su bị Phi-lát xét xử",
    tham_chieu: "Giăng 19:6",
    trich: "Ta chẳng thấy người nầy có tội lỗi chi hết.",
    suy_niem: "Ngay cả quan xét cũng tuyên Ngài vô tội, song vẫn giao nộp." },
  { so: 6,  tua: "Đức Chúa Giê-su bị đánh đòn và đội mão gai",
    tham_chieu: "Giăng 19:1-2",
    trich: "Phi-lát bắt Đức Chúa Giê-su và sai đánh đòn Ngài. Bọn lính… đội trên đầu Ngài một cái mão bằng gai.",
    suy_niem: "Vua trên muôn vua mang mão gai vì tội lỗi chúng ta." },
  { so: 7,  tua: "Đức Chúa Giê-su vác thập tự giá",
    tham_chieu: "Giăng 19:17",
    trich: "Đức Chúa Giê-su vác thập tự giá mình, đi đến ngoài thành, tại nơi gọi là cái Sọ.",
    suy_niem: "Ngài gánh lấy cây gỗ nặng, và gánh luôn cả gánh nặng của ta." },
  { so: 8,  tua: "Si-môn người Sy-ren vác giúp thập tự giá",
    tham_chieu: "Lu-ca 23:26",
    trich: "Chúng bắt một người… tên là Si-môn, buộc phải vác cây thập tự theo sau Đức Chúa Giê-su.",
    suy_niem: "Ai theo Ngài đều được kêu gọi cùng vác thập tự giá." },
  { so: 9,  tua: "Đức Chúa Giê-su gặp các phụ nữ thành Giê-ru-sa-lem",
    tham_chieu: "Lu-ca 23:28",
    trich: "Hỡi con gái thành Giê-ru-sa-lem, đừng khóc về ta, song hãy khóc về chính mình các ngươi.",
    suy_niem: "Trong cơn đau, lòng Ngài vẫn hướng về người khác." },
  { so: 10, tua: "Đức Chúa Giê-su bị đóng đinh trên thập tự giá",
    tham_chieu: "Lu-ca 23:33-34",
    trich: "Họ đóng đinh Ngài… Đức Chúa Giê-su cầu rằng: Lạy Cha, xin tha cho họ, vì họ không biết mình làm điều gì.",
    suy_niem: "Bị đóng đinh, Ngài mở lời tha thứ trước tiên." },
  { so: 11, tua: "Đức Chúa Giê-su hứa với kẻ trộm biết ăn năn",
    tham_chieu: "Lu-ca 23:43",
    trich: "Quả thật, ta nói cùng ngươi, hôm nay ngươi sẽ được ở với ta trong nơi Ba-ra-đi.",
    suy_niem: "Ngay giờ cuối, ân điển vẫn rộng mở cho kẻ tin." },
  { so: 12, tua: "Đức Chúa Giê-su trối Mẹ mình cho môn đồ",
    tham_chieu: "Giăng 19:26-27",
    trich: "Hỡi đàn bà kia, đó là con của ngươi! Đoạn, Ngài phán cùng người môn đồ: Đó là mẹ ngươi!",
    suy_niem: "Trên thập tự giá, Ngài vẫn chăm lo cho người mình yêu." },
  { so: 13, tua: "Đức Chúa Giê-su trút hơi thở cuối cùng",
    tham_chieu: "Lu-ca 23:46",
    trich: "Hỡi Cha, tôi giao linh hồn lại trong tay Cha! Ngài vừa nói xong thì tắt hơi.",
    suy_niem: "Công việc đã trọn; Ngài phó linh hồn cho Đức Chúa Trời." },
  { so: 14, tua: "Đức Chúa Giê-su được an táng trong mộ",
    tham_chieu: "Giăng 19:41-42",
    trich: "Tại nơi Ngài bị đóng đinh có một cái vườn, trong vườn có một cái huyệt mới… họ bèn chôn Đức Chúa Giê-su tại đó.",
    suy_niem: "Trong yên lặng của ngôi mộ, hy vọng phục sinh đang chờ." }
];

// Assign each station an evenly spaced z-stop between z=-6 and near Golgotha.
const FIRST_Z = -6;
const LAST_Z = -(STREET_LENGTH - 18);
STATIONS.forEach((s, i) => {
  s.z = FIRST_Z + (LAST_Z - FIRST_Z) * (i / (STATIONS.length - 1));
});
```

- [ ] **Step 2: Verify data shape in the console**

Reload the page, open DevTools Console, run:

```js
STATIONS.length
STATIONS[0]
STATIONS[13].z < STATIONS[0].z
```

Expected: `14`; an object with keys `so, tua, tham_chieu, trich, suy_niem, z`; and `true` (later stations are further down −Z). Console otherwise empty. (No visual change expected.)

- [ ] **Step 3: Commit**

```bash
git add static/con-duong-thuong-kho/index.html
git commit -m "feat(via-dolorosa): 14 Scriptural Stations data"
```

---

### Task 4: Station panel overlay + framing cards (DOM, cross-fade)

Adds the HTML/CSS overlay layer and a render function that shows a given station's panel (or an intro/closing card) with a cross-fade. Driven manually in this task; wired to navigation in Task 5.

**Files:**
- Modify: `static/con-duong-thuong-kho/index.html` (add overlay HTML, CSS, and `showPanel()` / `showCard()`)

**Interfaces:**
- Consumes: `STATIONS` (from Task 3).
- Produces:
  - `function showStation(index)` — renders `STATIONS[index]`'s panel and fades it in; fades out whatever was shown.
  - `function showCard(kind)` — `kind` is `"intro"` or `"outro"`; renders the framing card.
  - `function hideOverlay()` — fades the current panel/card out.

- [ ] **Step 1: Add overlay markup**

Add this **inside `<body>`, immediately after `<canvas id="scene"></canvas>`**:

```html
<div id="overlay">
  <div id="panel" class="hidden">
    <div id="progress"></div>
    <h1 id="tua"></h1>
    <blockquote id="trich"></blockquote>
    <cite id="ref"></cite>
    <p id="suyniem"></p>
  </div>
  <div id="card" class="hidden">
    <h1 id="card-title"></h1>
    <p id="card-body"></p>
    <button id="card-action" type="button"></button>
  </div>
</div>
```

- [ ] **Step 2: Add overlay CSS**

Add these rules inside the existing `<style>` block (after the `#scene` rule):

```css
  #overlay { position: fixed; inset: 0; pointer-events: none; z-index: 10; }
  #panel, #card {
    position: absolute; left: 50%; transform: translateX(-50%);
    width: min(92vw, 640px); color: #fff8ec;
    transition: opacity 0.7s ease; opacity: 1;
    text-shadow: 0 2px 8px rgba(0,0,0,0.7);
  }
  #panel {
    bottom: max(6vh, env(safe-area-inset-bottom, 0px));
    background: linear-gradient(0deg, rgba(20,12,4,0.78), rgba(20,12,4,0.15));
    padding: 1.4rem 1.6rem 1.6rem; border-radius: 14px;
    backdrop-filter: blur(3px);
  }
  #card {
    top: 50%; transform: translate(-50%, -50%);
    text-align: center; pointer-events: auto;
    background: rgba(20,12,4,0.72); padding: 2.2rem 2rem; border-radius: 16px;
  }
  #panel.hidden, #card.hidden { opacity: 0; }
  #progress { font-size: 0.8rem; letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.85; margin-bottom: 0.5rem; }
  #tua { font-size: clamp(1.15rem, 3.4vw, 1.6rem); font-weight: 600; line-height: 1.3; margin-bottom: 0.8rem; }
  #trich { font-size: clamp(0.98rem, 2.6vw, 1.12rem); font-style: italic; line-height: 1.55; border-left: 3px solid rgba(255,208,138,0.7); padding-left: 0.9rem; margin-bottom: 0.5rem; }
  #ref { display: block; font-size: 0.85rem; opacity: 0.8; margin-bottom: 0.9rem; }
  #suyniem { font-size: clamp(0.95rem, 2.4vw, 1.05rem); line-height: 1.5; opacity: 0.95; }
  #card h1 { font-size: clamp(1.4rem, 4vw, 2rem); margin-bottom: 1rem; }
  #card p { font-size: 1.05rem; line-height: 1.55; margin-bottom: 1.4rem; opacity: 0.95; }
  #card-action { pointer-events: auto; cursor: pointer; font: inherit; font-size: 1rem; color: #1a1208; background: #ffd08a; border: none; border-radius: 999px; padding: 0.6rem 1.6rem; }
```

- [ ] **Step 3: Add the panel/card render functions**

Add at the end of the module (after the `STATIONS` block):

```javascript
const panelEl = document.getElementById('panel');
const cardEl = document.getElementById('card');
const el = {
  progress: document.getElementById('progress'),
  tua: document.getElementById('tua'),
  trich: document.getElementById('trich'),
  ref: document.getElementById('ref'),
  suyniem: document.getElementById('suyniem'),
  cardTitle: document.getElementById('card-title'),
  cardBody: document.getElementById('card-body'),
  cardAction: document.getElementById('card-action')
};

function showStation(index) {
  const s = STATIONS[index];
  cardEl.classList.add('hidden');
  el.progress.textContent = `Chặng ${s.so} / ${STATIONS.length}`;
  el.tua.textContent = s.tua;
  el.trich.textContent = `“${s.trich}”`;
  el.ref.textContent = s.tham_chieu;
  el.suyniem.textContent = s.suy_niem;
  panelEl.classList.remove('hidden');
}

function showCard(kind) {
  panelEl.classList.add('hidden');
  if (kind === 'intro') {
    el.cardTitle.textContent = "Con Đường Thương Khó";
    el.cardBody.textContent = "Bước theo con đường thương khó của Đức Chúa Giê-su, qua mười bốn chặng đường thập tự giá.";
    el.cardAction.textContent = "Bắt đầu";
  } else {
    el.cardTitle.textContent = "Ngài đã sống lại";
    el.cardBody.textContent = "Ngôi mộ trống là niềm hy vọng của chúng ta. Sự chết không giữ được Đấng Sống.";
    el.cardAction.textContent = "Bắt đầu lại";
  }
  cardEl.classList.remove('hidden');
}

function hideOverlay() {
  panelEl.classList.add('hidden');
  cardEl.classList.add('hidden');
}

// Temporary manual check for this task; removed/replaced in Task 5.
showCard('intro');
```

- [ ] **Step 4: Serve and verify the overlay**

Serve and open the page.
Expected: the "Con Đường Thương Khó" intro card is centered over the scene with a "Bắt đầu" button. In the Console, run `showStation(0)` → the intro card fades out and Station 1's panel fades in at the bottom (progress "Chặng 1 / 14", title, italic quote, reference, meditation), diacritics correct. Run `showCard('outro')` → the "Ngài đã sống lại" card appears. Console empty.

- [ ] **Step 5: Remove the temporary call and commit**

Delete the line `showCard('intro');` added in Step 3 (Task 5 will drive the overlay). Then:

```bash
git add static/con-duong-thuong-kho/index.html
git commit -m "feat(via-dolorosa): station panel overlay and framing cards"
```

---

### Task 5: Rail controller — tweened camera, look-around, keyboard + touch nav

Ties it together: camera eases to each station's stop, ←/→ pan the head within bounds, ↓/Space advance and ↑ goes back, intro/outro cards gate the ends, and on-screen touch buttons mirror the keys. Adds a one-time controls hint.

**Files:**
- Modify: `static/con-duong-thuong-kho/index.html` (add nav-button markup + CSS, the rail controller, input handlers, and a per-frame update in `animate()`)

**Interfaces:**
- Consumes: `camera`, `clock`, `animate` loop, `STATIONS`, `showStation`, `showCard`, `hideOverlay` (Tasks 1, 3, 4).
- Produces:
  - `let current` — `-1` = intro card, `0..13` = station index, `14` = outro card.
  - `function goTo(target)` — clamps to `[-1, 14]`, sets tween target, updates overlay.
  - `function updateCamera(dt)` — called each frame; eases camera toward the current stop and applies look-around + idle bob.

- [ ] **Step 1: Add nav-button markup**

Add **inside `<body>`, after the `<div id="overlay">…</div>`**:

```html
<div id="nav">
  <button id="prev" type="button" aria-label="Chặng trước">◄</button>
  <button id="look" type="button" aria-label="Nhìn quanh">●</button>
  <button id="next" type="button" aria-label="Chặng kế">►</button>
</div>
<div id="hint">↓ hoặc Space để tiến bước · ↑ để lùi lại · ←/→ để nhìn quanh</div>
```

- [ ] **Step 2: Add nav + hint CSS**

Add inside the `<style>` block:

```css
  #nav { position: fixed; left: 50%; bottom: 1rem; transform: translateX(-50%); display: flex; gap: 0.75rem; z-index: 20; }
  #nav button { pointer-events: auto; cursor: pointer; width: 3rem; height: 3rem; border-radius: 999px; border: 1px solid rgba(255,232,200,0.5); background: rgba(20,12,4,0.55); color: #ffe9c8; font-size: 1.1rem; backdrop-filter: blur(4px); }
  #nav button:active { background: rgba(255,208,138,0.35); }
  #hint { position: fixed; top: 1rem; left: 50%; transform: translateX(-50%); z-index: 20; color: #fff8ec; font-size: 0.82rem; text-align: center; background: rgba(20,12,4,0.5); padding: 0.4rem 0.9rem; border-radius: 999px; text-shadow: 0 1px 4px rgba(0,0,0,0.6); transition: opacity 0.6s ease; }
  #hint.gone { opacity: 0; }
```

- [ ] **Step 3: Add the rail controller and input handlers**

Add at the end of the module (after the overlay functions from Task 4):

```javascript
// current: -1 intro, 0..13 stations, 14 outro
let current = -1;
let camZTarget = 4;        // start a little before station 1
let camZ = 4;
let lookYaw = 0;           // left/right head pan, radians
let lookTarget = 0;
const LOOK_LIMIT = 0.5;

function stopZFor(state) {
  if (state <= -1) return 6;
  if (state >= STATIONS.length) return STATIONS[STATIONS.length - 1].z - 6;
  return STATIONS[state].z;
}

function goTo(target) {
  const clamped = Math.max(-1, Math.min(STATIONS.length, target));
  if (clamped === current) return;
  current = clamped;
  camZTarget = stopZFor(current);
  lookTarget = 0; // recenter gaze on move
  if (current === -1) showCard('intro');
  else if (current === STATIONS.length) showCard('outro');
  else showStation(current);
  dismissHint();
}

let hintTimer = 0;
function dismissHint() {
  const h = document.getElementById('hint');
  if (h && !h.classList.contains('gone')) h.classList.add('gone');
}

function updateCamera(dt) {
  // Ease camera Z toward target (frame-rate independent).
  const k = 1 - Math.pow(0.0025, dt);
  camZ += (camZTarget - camZ) * k;
  lookYaw += (lookTarget - lookYaw) * k;
  const bob = Math.sin(clock.elapsedTime * 1.4) * 0.02;
  camera.position.set(0, 1.7 + bob, camZ);
  camera.rotation.set(0, lookYaw, 0);
}

// --- Keyboard ---
window.addEventListener('keydown', (e) => {
  switch (e.key) {
    case 'ArrowDown': case ' ': case 'Spacebar':
      e.preventDefault(); goTo(current + 1); break;
    case 'ArrowUp':
      e.preventDefault(); goTo(current - 1); break;
    case 'ArrowLeft':
      e.preventDefault(); lookTarget = -LOOK_LIMIT; break;
    case 'ArrowRight':
      e.preventDefault(); lookTarget = LOOK_LIMIT; break;
  }
});
window.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') lookTarget = 0;
});

// --- Touch / click buttons ---
document.getElementById('next').addEventListener('click', () => goTo(current + 1));
document.getElementById('prev').addEventListener('click', () => goTo(current - 1));
const lookBtn = document.getElementById('look');
lookBtn.addEventListener('pointerdown', () => { lookTarget = LOOK_LIMIT; });
lookBtn.addEventListener('pointerup', () => { lookTarget = 0; });
lookBtn.addEventListener('pointerleave', () => { lookTarget = 0; });

// Card action button: intro -> station 1; outro -> restart to intro.
el.cardAction.addEventListener('click', () => {
  if (current === STATIONS.length) { goTo(-1); }
  else { goTo(0); }
});

// Start on the intro card.
showCard('intro');
```

- [ ] **Step 4: Call `updateCamera` in the render loop**

In the `animate()` function from Task 1, add the update before `renderer.render`. Change:

```javascript
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
```

to:

```javascript
function animate() {
  requestAnimationFrame(animate);
  updateCamera(clock.getDelta());
  renderer.render(scene, camera);
}
```

- [ ] **Step 5: Serve and verify full navigation**

Serve and open the page. Verify all of:
1. Intro card "Con Đường Thương Khó" shows; clicking "Bắt đầu" fades it out and glides the camera to Station 1's panel.
2. `↓`/`Space` and the `►` button advance station-by-station; the camera eases smoothly (no hard cuts) and each panel cross-fades. Content is correct Vietnamese with proper diacritics.
3. `↑` and `◄` go back a station; reaching before Station 1 shows the intro card again.
4. Advancing past Station 14 shows the "Ngài đã sống lại" outro card; "Bắt đầu lại" returns to the intro.
5. Holding `←`/`→` (or pressing `●`) pans the gaze left/right within a bounded range and recenters on release / on moving to another station. The camera never leaves the street centerline.
6. The top hint disappears after the first navigation.
7. Resize the window — layout and scene stay correct. Console empty throughout.

- [ ] **Step 6: Commit**

```bash
git add static/con-duong-thuong-kho/index.html
git commit -m "feat(via-dolorosa): rail camera, look-around, keyboard and touch navigation"
```

---

### Task 6: Polish pass — mobile framing, reduced-motion, final content proofread

Final review task: verify terminology/typography rules, tune the look on a narrow viewport, and respect `prefers-reduced-motion`.

**Files:**
- Modify: `static/con-duong-thuong-kho/index.html`

**Interfaces:**
- Consumes: everything from Tasks 1–5. Produces: no new globals.

- [ ] **Step 1: Respect reduced motion**

Add to the `<style>` block:

```css
  @media (prefers-reduced-motion: reduce) {
    #panel, #card, #hint { transition: none; }
  }
```

And in `updateCamera`, make the idle bob honor the preference. Change:

```javascript
  const bob = Math.sin(clock.elapsedTime * 1.4) * 0.02;
```

to:

```javascript
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const bob = reduce ? 0 : Math.sin(clock.elapsedTime * 1.4) * 0.02;
```

- [ ] **Step 2: Content proofread against project rules**

Read the whole `STATIONS` array and every UI string in the file and confirm, fixing any violation inline:
- "Đức Chúa Giê-su" everywhere (never "Chúa Giê-su"/"Jesus"/"Giê-xu").
- Divine names capitalized: "Đức Chúa Trời", "Kinh Thánh", "Giê-ru-sa-lem".
- Ellipsis is "…" (not "...").
- A space follows every comma.
- No absolute `phucam.tv` URLs anywhere in the file.

- [ ] **Step 3: Serve and verify on a narrow viewport**

Serve, open the page, and in DevTools toggle a mobile device (e.g. iPhone width ~390px). Verify:
- The station panel fits within the viewport, is readable, and does not overlap the bottom nav buttons.
- The intro/outro cards are centered and their buttons are tappable.
- `►`/`◄`/`●` buttons work by tap; advancing through all 14 stations to the outro and back works.
- With OS "Reduce Motion" on, the idle bob stops and panel fades are instant; navigation still works.
- Console empty.

- [ ] **Step 4: Commit**

```bash
git add static/con-duong-thuong-kho/index.html
git commit -m "feat(via-dolorosa): mobile framing, reduced-motion, content proofread"
```

---

## Self-Review

**Spec coverage:**
- Guided rail, user-paced → Task 5 (`goTo`, tweened `updateCamera`). ✔
- 14 station-stops on a spline → Tasks 3 (z positions) + 5 (rail). ✔
- Controls ↓/Space/↑/←/→ + touch buttons → Task 5. ✔
- Intro "Bắt đầu" + outro "Ngài đã sống lại" cards → Tasks 4 + 5. ✔
- Literal sandstone street (ground, walls, arches, steps) → Task 2. ✔
- Palette / dusk lighting / one shadow light / fog → Tasks 1 + 2. ✔
- Golgotha hill + growing cross + tomb → Task 2. ✔
- Camera easing + idle bob → Tasks 5 + 6. ✔
- 14 Scriptural Stations, Vietnamese, site terminology → Tasks 3 + 6. ✔
- Panel: number/progress, title, quote+ref, meditation, cross-fade → Task 4. ✔
- File at `static/con-duong-thuong-kho/index.html`, self-contained, Three.js CDN via importmap, relative paths, no front matter → Tasks 1–6. ✔
- Success criteria (no console errors, both-direction reachability, keyboard+touch, diacritics, performance) → verification steps in Tasks 1–6. ✔

**Placeholder scan:** No TBD/TODO/"handle edge cases"; every code step shows complete code. ✔

**Type consistency:** `showStation`/`showCard`/`hideOverlay` defined in Task 4 and consumed by name in Task 5; `STATIONS` shape (`so, tua, tham_chieu, trich, suy_niem, z`) defined in Task 3 and read consistently in Tasks 4/5/6; `current`/`goTo`/`updateCamera`/`camZ`/`lookTarget` all defined and used in Task 5; `animate`/`clock`/`camera`/`scene` from Task 1 extended, not redefined. ✔
