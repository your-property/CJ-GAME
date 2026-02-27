/* ============================================================
   C.J. OPEN WORLD ULTRA — game.js
   Full daytime open world, realistic car, smooth physics
   ============================================================ */
'use strict';

// ─────────────────────────────────────────────────────────────
// GLOBALS & STATE
// ─────────────────────────────────────────────────────────────
const gameCanvas = document.getElementById('gameCanvas');
const hudCanvas  = document.getElementById('hudCanvas');
const hud        = hudCanvas.getContext('2d');

let gameStarted = false;
let gamePaused  = false;
let cameraMode  = 0; // 0=chase, 1=hood, 2=orbit
let lookBack    = false;

// ─────────────────────────────────────────────────────────────
// RENDERER
// ─────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({
  canvas: gameCanvas,
  antialias: true,
  powerPreference: 'high-performance',
  logarithmicDepthBuffer: false
});
renderer.shadowMap.enabled    = true;
renderer.shadowMap.type       = THREE.PCFSoftShadowMap;
renderer.toneMapping          = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure  = 1.15;
renderer.physicallyCorrectLights = true;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 0.15, 1400);

function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  hudCanvas.width  = w;
  hudCanvas.height = h;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
onResize();
window.addEventListener('resize', onResize);

// ─────────────────────────────────────────────────────────────
// WORLD CONSTANTS
// ─────────────────────────────────────────────────────────────
const GRID  = 10;
const BLOCK = 36;
const ROAD  = 14;
const CELL  = BLOCK + ROAD;    // 50
const WORLD = GRID * CELL;     // 500
const HALF  = WORLD / 2;       // 250

// ─────────────────────────────────────────────────────────────
// SKY — procedural gradient sphere
// ─────────────────────────────────────────────────────────────
const SKY_VERT = `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const SKY_FRAG = `
  varying vec3 vDir;
  uniform float timeOfDay;
  void main() {
    vec3 d = normalize(vDir);
    float h = clamp(d.y, 0.0, 1.0);

    // Day sky colours
    vec3 zenith  = vec3(0.18, 0.46, 0.85);
    vec3 horizon = vec3(0.72, 0.88, 1.00);
    vec3 ground  = vec3(0.36, 0.30, 0.25);

    vec3 sky = mix(horizon, zenith, pow(h, 0.55));
    sky = mix(ground, sky, step(0.0, d.y));

    // Sun position (slightly above horizon, right-ish)
    vec3 sunDir = normalize(vec3(0.55, 0.38, 0.75));
    float sd    = dot(d, sunDir);

    // Sun disk + corona
    float sunGlow = pow(max(sd, 0.0), 26.0);
    float sunDisk = smoothstep(0.9994, 0.9998, sd) * 12.0;
    sky += vec3(1.0, 0.90, 0.55) * sunGlow * 1.8;
    sky += vec3(1.0, 0.97, 0.90) * sunDisk;

    // Atmospheric scattering near horizon
    float horiz = pow(1.0 - abs(d.y), 5.5) * 0.35;
    sky += vec3(1.0, 0.75, 0.45) * horiz;

    // Slight vignette tint at top
    sky = mix(sky, sky * vec3(0.92, 0.95, 1.02), h * 0.4);

    gl_FragColor = vec4(sky, 1.0);
  }
`;

const skyGeo = new THREE.SphereGeometry(1100, 24, 12);
skyGeo.scale(-1, 1, 1);
const skyMesh = new THREE.Mesh(skyGeo, new THREE.ShaderMaterial({
  vertexShader: SKY_VERT,
  fragmentShader: SKY_FRAG,
  uniforms: { timeOfDay: { value: 0.5 } },
  side: THREE.BackSide,
  depthWrite: false
}));
scene.add(skyMesh);

// Mild daytime fog
scene.fog = new THREE.Fog(0xc8dff5, 280, 800);

// ─────────────────────────────────────────────────────────────
// LIGHTING — natural daytime
// ─────────────────────────────────────────────────────────────

// Sun
const sunLight = new THREE.DirectionalLight(0xfff5e0, 4.2);
sunLight.position.set(220, 280, 160);
sunLight.castShadow = true;
const sc = sunLight.shadow.camera;
sc.near = 1; sc.far = 900;
sc.left = sc.bottom = -350;
sc.right = sc.top = 350;
sunLight.shadow.mapSize.set(4096, 4096);
sunLight.shadow.bias = -0.0003;
sunLight.shadow.normalBias = 0.04;
scene.add(sunLight);

// Fill / bounce
scene.add(new THREE.AmbientLight(0x8fbfe8, 1.4));
scene.add(new THREE.HemisphereLight(0x9dcff0, 0x607040, 1.8));

// Secondary warm fill (golden bounce off ground)
const fillLight = new THREE.DirectionalLight(0xffd580, 0.55);
fillLight.position.set(-100, 30, -80);
scene.add(fillLight);

// ─────────────────────────────────────────────────────────────
// MATERIALS PALETTE
// ─────────────────────────────────────────────────────────────
const MAT = {};

// Ground
MAT.grass    = new THREE.MeshLambertMaterial({ color: 0x5a8a38 });
MAT.asphalt  = new THREE.MeshLambertMaterial({ color: 0x282828 });
MAT.asphaltL = new THREE.MeshLambertMaterial({ color: 0x2f2f2f });
MAT.sidewalk = new THREE.MeshLambertMaterial({ color: 0xb8b0a0 });
MAT.curb     = new THREE.MeshLambertMaterial({ color: 0xccccbb });
MAT.marking  = new THREE.MeshLambertMaterial({ color: 0xf0f0e0 });
MAT.yellowM  = new THREE.MeshLambertMaterial({ color: 0xf5d020 });
MAT.crosswk  = new THREE.MeshLambertMaterial({ color: 0xe8e6df });

// Car
MAT.carBody  = new THREE.MeshLambertMaterial({ color: 0xcc2200 });  // Red sports car
MAT.carBody2 = new THREE.MeshLambertMaterial({ color: 0xaa1a00 });  // Darker panels
MAT.carRoof  = new THREE.MeshLambertMaterial({ color: 0xbb1f00 });
MAT.glass    = new THREE.MeshLambertMaterial({ color: 0x4488bb, transparent: true, opacity: 0.7 });
MAT.glassDk  = new THREE.MeshLambertMaterial({ color: 0x224466, transparent: true, opacity: 0.65 });
MAT.tire     = new THREE.MeshLambertMaterial({ color: 0x101010 });
MAT.rim      = new THREE.MeshLambertMaterial({ color: 0xd8d0c0 });
MAT.rimSpoke = new THREE.MeshLambertMaterial({ color: 0xc0b8a8 });
MAT.headL    = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 3.0 });
MAT.tailL    = new THREE.MeshLambertMaterial({ color: 0xff1500, emissive: 0xff1500, emissiveIntensity: 4.0 });
MAT.chrome   = new THREE.MeshLambertMaterial({ color: 0xe0e0e0 });
MAT.rubber   = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
MAT.undercar = new THREE.MeshLambertMaterial({ color: 0x222222 });

// World
MAT.poleMet  = new THREE.MeshLambertMaterial({ color: 0x707070 });
MAT.lampBulb = new THREE.MeshLambertMaterial({ color: 0xffd080, emissive: 0xffc840, emissiveIntensity: 1.8 });
MAT.trunk    = new THREE.MeshLambertMaterial({ color: 0x4a3020 });
MAT.leaf     = new THREE.MeshLambertMaterial({ color: 0x2d6018 });
MAT.leafDk   = new THREE.MeshLambertMaterial({ color: 0x1e4810 });
MAT.fence    = new THREE.MeshLambertMaterial({ color: 0x909090 });
MAT.sign     = new THREE.MeshLambertMaterial({ color: 0x2255aa });
MAT.signText = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.4 });
MAT.concrete = new THREE.MeshLambertMaterial({ color: 0x9a9a95 });
MAT.rooftop  = new THREE.MeshLambertMaterial({ color: 0x8a8a85 });
MAT.waterTk  = new THREE.MeshLambertMaterial({ color: 0x555a60 });
MAT.hvac     = new THREE.MeshLambertMaterial({ color: 0x606060 });
MAT.parkGrn  = new THREE.MeshLambertMaterial({ color: 0x3d7825 });
MAT.pathMat  = new THREE.MeshLambertMaterial({ color: 0xc8b898 });
MAT.bench    = new THREE.MeshLambertMaterial({ color: 0x7a5030 });
MAT.hydrant  = new THREE.MeshLambertMaterial({ color: 0xcc2200 });

function randBldMat() {
  const palette = [
    0xd4c8b8, 0xe2d8cc, 0xc8d0d8, 0xb4c0cc, 0xd8cec4,
    0xe0d8d0, 0xc0b8b0, 0xccd4e0, 0xe0ddd4, 0xaabbc8,
    0xc8c4bc, 0xd4ccc0, 0xb8c8b8, 0xe8e0d4, 0xbcc4cc
  ];
  const c = palette[Math.floor(Math.random() * palette.length)];
  return new THREE.MeshLambertMaterial({ color: c });
}

// ─────────────────────────────────────────────────────────────
// HELPER: quick mesh
// ─────────────────────────────────────────────────────────────
function mkMesh(geo, mat, x, y, z, rx, ry, rz, parent) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x||0, y||0, z||0);
  if (rx !== undefined) m.rotation.x = rx;
  if (ry !== undefined) m.rotation.y = ry;
  if (rz !== undefined) m.rotation.z = rz;
  m.castShadow = true; m.receiveShadow = true;
  (parent || scene).add(m);
  return m;
}
function box(w, h, d) { return new THREE.BoxGeometry(w, h, d); }
function cyl(rt, rb, h, s) { return new THREE.CylinderGeometry(rt, rb, h, s||12); }

// ─────────────────────────────────────────────────────────────
// GROUND
// ─────────────────────────────────────────────────────────────
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(WORLD * 4, WORLD * 4, 1, 1),
  MAT.grass
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Subtle ground texture variation patches
for (let i = 0; i < 60; i++) {
  const pw = 10 + Math.random() * 30, pd = 10 + Math.random() * 30;
  const p = new THREE.Mesh(
    box(pw, 0.04, pd),
    new THREE.MeshLambertMaterial({
      color: new THREE.Color(
        0.30 + Math.random() * 0.08,
        0.48 + Math.random() * 0.14,
        0.18 + Math.random() * 0.08
      )
    })
  );
  const angle = Math.random() * Math.PI * 2;
  const dist  = 80 + Math.random() * HALF * 2.5;
  p.position.set(Math.cos(angle)*dist, 0.01, Math.sin(angle)*dist);
  p.rotation.y = Math.random() * Math.PI;
  ground.add(p);
}

// ─────────────────────────────────────────────────────────────
// ROAD SYSTEM
// ─────────────────────────────────────────────────────────────
const roadGeos = [];

function addRoad(x, y, z, w, h, d) {
  const m = new THREE.Mesh(box(w, h, d), MAT.asphalt);
  m.position.set(x, y, z);
  m.receiveShadow = true; m.castShadow = false;
  scene.add(m);
}

for (let i = 0; i <= GRID; i++) {
  const p = -HALF + i * CELL;
  // Vertical road strip
  addRoad(p + ROAD/2, 0.03, 0, ROAD, 0.05, WORLD * 1.25);
  // Horizontal road strip
  addRoad(0, 0.03, p + ROAD/2, WORLD * 1.25, 0.05, ROAD);
  // Sidewalks
  const sideW = 2.2;
  const sm1 = new THREE.Mesh(box(sideW, 0.12, WORLD*1.25), MAT.sidewalk);
  sm1.position.set(p + ROAD + sideW/2, 0.05, 0); sm1.receiveShadow=true; scene.add(sm1);
  const sm2 = new THREE.Mesh(box(sideW, 0.12, WORLD*1.25), MAT.sidewalk);
  sm2.position.set(p - sideW/2, 0.05, 0); sm2.receiveShadow=true; scene.add(sm2);
  const sm3 = new THREE.Mesh(box(WORLD*1.25, 0.12, sideW), MAT.sidewalk);
  sm3.position.set(0, 0.05, p + ROAD + sideW/2); sm3.receiveShadow=true; scene.add(sm3);
  const sm4 = new THREE.Mesh(box(WORLD*1.25, 0.12, sideW), MAT.sidewalk);
  sm4.position.set(0, 0.05, p - sideW/2); sm4.receiveShadow=true; scene.add(sm4);
  // Curbs
  const cm1 = new THREE.Mesh(box(0.18, 0.16, WORLD*1.25), MAT.curb);
  cm1.position.set(p + ROAD + 0.09, 0.06, 0); cm1.receiveShadow=true; scene.add(cm1);
  const cm2 = new THREE.Mesh(box(0.18, 0.16, WORLD*1.25), MAT.curb);
  cm2.position.set(p - 0.09, 0.06, 0); cm2.receiveShadow=true; scene.add(cm2);
}

// Lane markings
const dashGeo = box(0.16, 0.07, 4.5);
const dashGeoH = box(4.5, 0.07, 0.16);
const ydashGeo  = box(0.12, 0.07, 3.2);
const ydashGeoH = box(3.2, 0.07, 0.12);

for (let i = 0; i <= GRID; i++) {
  const p = -HALF + i * CELL + ROAD/2;
  const centerL = p - ROAD/4;
  const centerR = p + ROAD/4;
  for (let t = -HALF; t < HALF; t += 9) {
    // White dashes
    const dV = new THREE.Mesh(dashGeo, MAT.marking);
    dV.position.set(p, 0.06, t + 2.25); scene.add(dV);
    const dH = new THREE.Mesh(dashGeoH, MAT.marking);
    dH.position.set(t + 2.25, 0.06, p); scene.add(dH);
    // Yellow center
    const yV = new THREE.Mesh(ydashGeo, MAT.yellowM);
    yV.position.set(centerL, 0.065, t + 1.6); scene.add(yV);
    const yH = new THREE.Mesh(ydashGeoH, MAT.yellowM);
    yH.position.set(t + 1.6, 0.065, centerL); scene.add(yH);
  }
}

// Crosswalks at every intersection
for (let i = 0; i <= GRID; i++) {
  for (let j = 0; j <= GRID; j++) {
    const ix = -HALF + i * CELL + ROAD/2;
    const iz = -HALF + j * CELL + ROAD/2;
    for (let s = -3; s <= 3; s += 1.5) {
      const cV = new THREE.Mesh(box(0.95, 0.08, ROAD * 0.72), MAT.crosswk);
      cV.position.set(ix + s, 0.065, iz); scene.add(cV);
      const cH = new THREE.Mesh(box(ROAD * 0.72, 0.08, 0.95), MAT.crosswk);
      cH.position.set(ix, 0.065, iz + s); scene.add(cH);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// BUILDINGS REGISTRY
// ─────────────────────────────────────────────────────────────
const buildings = [];

const winColors = [
  new THREE.MeshLambertMaterial({ color: 0xeef5ff, transparent: true, opacity: 0.8 }),
  new THREE.MeshLambertMaterial({ color: 0xfff8e0, transparent: true, opacity: 0.75 }),
  new THREE.MeshLambertMaterial({ color: 0xe8f4f8, transparent: true, opacity: 0.75 }),
];

function buildWindowGrid(bx, by, bz, bw, bh, bd) {
  const floors   = Math.max(2, Math.floor(bh / 3.5));
  const cols     = Math.max(1, Math.floor(bw / 3.0));
  const wW = bw / (cols + 1) * 0.7;
  const wH = Math.min(2.0, bh / floors * 0.55);
  const mat = winColors[Math.floor(Math.random() * winColors.length)].clone();
  mat.emissive = new THREE.Color(0.3, 0.25, 0.1);
  mat.emissiveIntensity = 0.1 + Math.random() * 0.3;

  const isFront = true;
  for (let fl = 0; fl < floors; fl++) {
    const wy = bz - bd/2 - 0.06;
    const fy = by - bh/2 + (fl + 0.75) * (bh / floors);
    for (let col = 0; col < cols; col++) {
      if (Math.random() < 0.15) continue; // some dark windows
      const wx = bx - bw/2 + (col + 0.85) * (bw / (cols));
      const wm = new THREE.Mesh(box(wW, wH, 0.08), mat);
      wm.position.set(wx, fy, bz + bd/2 + 0.07);
      wm.receiveShadow = false; scene.add(wm);
      const wm2 = new THREE.Mesh(box(wW, wH, 0.08), mat);
      wm2.position.set(wx, fy, bz - bd/2 - 0.07);
      wm2.receiveShadow = false; scene.add(wm2);
    }
  }
}

for (let gx = 0; gx < GRID; gx++) {
  for (let gz = 0; gz < GRID; gz++) {
    const bx0 = -HALF + ROAD + gx * CELL;
    const bz0 = -HALF + ROAD + gz * CELL;
    const cx  = bx0 + BLOCK / 2;
    const cz  = bz0 + BLOCK / 2;

    // Sidewalk block pad
    const swPad = new THREE.Mesh(box(BLOCK + 0.5, 0.12, BLOCK + 0.5), MAT.sidewalk);
    swPad.position.set(cx, 0.04, cz);
    swPad.receiveShadow = true; scene.add(swPad);

    // ~12% chance: park block
    if (Math.random() < 0.12) {
      const pk = new THREE.Mesh(box(BLOCK - 0.8, 0.14, BLOCK - 0.8), MAT.parkGrn);
      pk.position.set(cx, 0.06, cz); scene.add(pk);
      // Paths
      const pth1 = new THREE.Mesh(box(BLOCK - 1.5, 0.1, 1.5), MAT.pathMat);
      pth1.position.set(cx, 0.08, cz); scene.add(pth1);
      const pth2 = new THREE.Mesh(box(1.5, 0.1, BLOCK - 1.5), MAT.pathMat);
      pth2.position.set(cx, 0.08, cz); scene.add(pth2);
      // Benches
      for (let bn = 0; bn < 4; bn++) {
        const bna = (bn/4) * Math.PI * 2;
        const bx = cx + Math.cos(bna) * (BLOCK/2 - 3.5);
        const bz2 = cz + Math.sin(bna) * (BLOCK/2 - 3.5);
        mkMesh(box(1.6, 0.12, 0.38), MAT.bench, bx, 0.38, bz2);
        mkMesh(box(1.6, 0.08, 0.06), MAT.bench, bx, 0.6, bz2 + 0.16);
      }
      // Trees
      const treeCount = 4 + Math.floor(Math.random() * 6);
      for (let t = 0; t < treeCount; t++) {
        const tx = bx0 + 3.5 + Math.random() * (BLOCK - 7);
        const tz = bz0 + 3.5 + Math.random() * (BLOCK - 7);
        placeTree(tx, tz, 3.5 + Math.random() * 4.5);
      }
      continue;
    }

    // 1 or 4 sub-buildings
    const count = Math.random() < 0.4 ? 1 : 4;
    const sub   = count === 4 ? BLOCK / 2 : BLOCK;

    for (let b = 0; b < count; b++) {
      const ox  = count === 4 ? (b % 2) * (BLOCK/2) : 0;
      const oz  = count === 4 ? Math.floor(b/2) * (BLOCK/2) : 0;
      const pad = 2.2;
      const bw  = sub * (0.58 + Math.random() * 0.32) - pad*2;
      const bd  = sub * (0.58 + Math.random() * 0.32) - pad*2;
      const bh  = 4 + Math.pow(Math.random(), 0.5) * 65;
      const bcx = bx0 + ox + sub/2;
      const bcz = bz0 + oz + sub/2;

      // Main building body
      const bm = new THREE.Mesh(box(bw, bh, bd), randBldMat());
      bm.position.set(bcx, bh/2, bcz);
      bm.castShadow = true; bm.receiveShadow = true;
      scene.add(bm);

      // Windows
      buildWindowGrid(bcx, bh/2, bcz, bw, bh, bd);

      // Roof details
      if (bh > 12) {
        // Rooftop parapet
        const rp = new THREE.Mesh(box(bw + 0.4, 0.6, bd + 0.4), MAT.concrete);
        rp.position.set(bcx, bh + 0.3, bcz); scene.add(rp);
        // Rooftop HVAC units
        if (bh > 18) {
          const hvacCount = 1 + Math.floor(Math.random() * 3);
          for (let hv = 0; hv < hvacCount; hv++) {
            const hx = bcx + (Math.random()-.5) * (bw*0.6);
            const hz = bcz + (Math.random()-.5) * (bd*0.6);
            const hw = 1.2 + Math.random(); const hd = 0.8 + Math.random();
            const hh = 0.6 + Math.random() * 0.8;
            mkMesh(box(hw, hh, hd), MAT.hvac, hx, bh + hh/2, hz);
          }
        }
        // Water tower on tall buildings
        if (bh > 35 && Math.random() < 0.45) {
          const wtH = 3.5, wtR = 1.2;
          mkMesh(cyl(wtR, wtR * 0.85, wtH, 8), MAT.waterTk, bcx + bw/2 - 2.5, bh + wtH/2, bcz + bd/2 - 2.5);
          mkMesh(cyl(wtR * 0.1, wtR * 0.1, 2.5, 6), MAT.poleMet, bcx + bw/2 - 2.5, bh + 1.2, bcz + bd/2 - 2.5);
        }
        // Antenna on very tall
        if (bh > 40 && Math.random() < 0.6) {
          const ah = 5 + Math.random() * 8;
          mkMesh(cyl(0.06, 0.12, ah, 6), MAT.poleMet, bcx, bh + ah/2, bcz);
          const blinkMat = new THREE.MeshLambertMaterial({ color: 0xff1100, emissive: 0xff1100, emissiveIntensity: 3 });
          mkMesh(new THREE.SphereGeometry(0.18, 5, 4), blinkMat, bcx, bh + ah + 0.2, bcz);
        }
        // Rooftop solar panel array
        if (bh > 20 && Math.random() < 0.3) {
          const solarMat = new THREE.MeshLambertMaterial({ color: 0x1a2a40 });
          for (let sp = 0; sp < 4; sp++) {
            const sx = bcx + (sp%2 - 0.5) * bw * 0.45;
            const sz = bcz + (Math.floor(sp/2) - 0.5) * bd * 0.35;
            const sm = new THREE.Mesh(box(2.2, 0.08, 1.4), solarMat);
            sm.position.set(sx, bh + 0.7, sz);
            sm.rotation.x = -0.35; scene.add(sm);
          }
        }
      }

      buildings.push({ x: bcx, z: bcz, hw: bw/2 + 0.6, hd: bd/2 + 0.6 });
    }
  }
}

// ─────────────────────────────────────────────────────────────
// TREES
// ─────────────────────────────────────────────────────────────
function placeTree(tx, tz, height, parent) {
  const trunkH = height * 0.55;
  const trunkR = 0.14 + height * 0.018;
  const leafR  = height * 0.38 + Math.random() * 0.6;
  const trunkMesh = new THREE.Mesh(cyl(trunkR * 0.7, trunkR, trunkH, 7), MAT.trunk);
  trunkMesh.position.set(tx, trunkH/2, tz);
  trunkMesh.castShadow = true; scene.add(trunkMesh);
  // Multi-layer foliage
  const layers = 2 + Math.floor(Math.random() * 2);
  for (let l = 0; l < layers; l++) {
    const lr = leafR * (1 - l * 0.22);
    const ly = trunkH + lr * 0.55 + l * leafR * 0.5;
    const leafMat = l % 2 === 0 ? MAT.leaf : MAT.leafDk;
    const lm = new THREE.Mesh(new THREE.SphereGeometry(lr, 8, 6), leafMat);
    lm.position.set(tx + (Math.random()-.5)*0.3, ly, tz + (Math.random()-.5)*0.3);
    lm.scale.y = 0.75 + Math.random() * 0.3;
    lm.castShadow = true; scene.add(lm);
  }
}

// Roadside trees along all roads
for (let i = 0; i <= GRID; i++) {
  for (let j = 0; j < GRID; j++) {
    const rx = -HALF + i * CELL;
    const rz = -HALF + ROAD + j * CELL;
    for (let k = 2; k < BLOCK - 2; k += 9) {
      if (Math.random() < 0.7) placeTree(rx + ROAD + 1.5, rz + k, 4 + Math.random() * 4);
      if (Math.random() < 0.7) placeTree(rx - 2.2, rz + k, 4 + Math.random() * 4);
    }
    const rz2 = rz - ROAD;
    const rxPos = rz;
    for (let k = 2; k < BLOCK - 2; k += 9) {
      if (Math.random() < 0.7) placeTree(rz + k, 0, rx + ROAD + 1.5);
      if (Math.random() < 0.7) placeTree(rz + k, 0, rx - 2.2);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// STREET LIGHTS — modern style
// ─────────────────────────────────────────────────────────────
function mkStreetLight(x, z, flip) {
  const poleH = 8.5;
  const pole = new THREE.Mesh(cyl(0.08, 0.13, poleH, 8), MAT.poleMet);
  pole.position.set(x, poleH/2, z);
  pole.castShadow = true; scene.add(pole);

  const armLen = flip ? -2.4 : 2.4;
  const armY   = poleH - 0.5;
  const arm = new THREE.Mesh(box(Math.abs(armLen), 0.12, 0.12), MAT.poleMet);
  arm.position.set(x + armLen/2, armY + 0.08, z);
  scene.add(arm);

  // Lamp housing
  const lampX = x + armLen;
  const lampZ = z;
  const housing = new THREE.Mesh(box(0.55, 0.22, 0.42), MAT.poleMet);
  housing.position.set(lampX, armY - 0.08, lampZ); scene.add(housing);
  const bulb = new THREE.Mesh(box(0.42, 0.08, 0.32), MAT.lampBulb);
  bulb.position.set(lampX, armY - 0.2, lampZ); scene.add(bulb);

  // Actual light — dimmer during day
  const pt = new THREE.PointLight(0xffdd88, 0.3, 18, 2);
  pt.position.set(lampX, armY - 0.3, lampZ);
  scene.add(pt);
}

for (let i = 0; i <= GRID; i++) {
  for (let j = 0; j < GRID; j++) {
    const rx  = -HALF + i * CELL;
    const rz0 = -HALF + ROAD + j * CELL;
    for (let k = 0; k < BLOCK; k += 18) {
      mkStreetLight(rx + 1.9,             rz0 + k + 8,  false);
      mkStreetLight(rx - ROAD/2 - 2.0,   rz0 + k + 8,  true);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// TRAFFIC SIGNS & PROPS
// ─────────────────────────────────────────────────────────────
for (let i = 0; i <= GRID; i++) {
  for (let j = 0; j <= GRID; j++) {
    const sx = -HALF + i * CELL + ROAD + 1;
    const sz = -HALF + j * CELL + ROAD + 1;
    // Stop sign pole
    mkMesh(cyl(0.04, 0.04, 3.0, 6), MAT.poleMet, sx, 1.5, sz);
    // Sign plate
    const signMesh = new THREE.Mesh(box(0.72, 0.72, 0.08), MAT.sign);
    signMesh.position.set(sx, 3.3, sz);
    signMesh.rotation.y = Math.PI/8;
    signMesh.castShadow = true; scene.add(signMesh);
    // Fire hydrant occasionally
    if (Math.random() < 0.3) {
      const hx = sx + 2 + Math.random() * 3;
      const hz = sz + Math.random() * 3;
      mkMesh(cyl(0.14, 0.18, 0.52, 6), MAT.hydrant, hx, 0.28, hz);
      mkMesh(cyl(0.06, 0.06, 0.18, 5), MAT.hydrant, hx, 0.6, hz);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// CLOUDS — slow moving realistic puffs
// ─────────────────────────────────────────────────────────────
const clouds = [];
function spawnCloud(x, y, z) {
  const g = new THREE.Group();
  const puffs = 5 + Math.floor(Math.random() * 6);
  for (let p = 0; p < puffs; p++) {
    const r = 10 + Math.random() * 16;
    const cloudMat = new THREE.MeshLambertMaterial({
      color: 0xffffff, transparent: true,
      opacity: 0.72 + Math.random() * 0.2
    });
    const cm = new THREE.Mesh(new THREE.SphereGeometry(r, 9, 7), cloudMat);
    cm.position.set((Math.random()-.5)*35, (Math.random()-.5)*8, (Math.random()-.5)*22);
    cm.scale.y = 0.55 + Math.random() * 0.25;
    g.add(cm);
  }
  g.position.set(x, y, z);
  g.userData.speed = 0.3 + Math.random() * 0.7;
  scene.add(g);
  clouds.push(g);
}
for (let i = 0; i < 22; i++) {
  spawnCloud(
    (Math.random()-.5) * 1200,
    90 + Math.random() * 80,
    (Math.random()-.5) * 1200
  );
}

// ─────────────────────────────────────────────────────────────
// PLAYER CAR — highly detailed
// ─────────────────────────────────────────────────────────────
const carGroup = new THREE.Group();
scene.add(carGroup);

// ── Body layers (realistic sedan-ish sports shape) ──
// Lower chassis / skirt
const chassis = new THREE.Mesh(box(2.08, 0.22, 4.85), MAT.undercar);
chassis.position.set(0, 0.26, 0);
chassis.castShadow = true; carGroup.add(chassis);

// Main body hull
const body = new THREE.Mesh(box(2.0, 0.44, 4.62), MAT.carBody);
body.position.set(0, 0.46, 0);
body.castShadow = true; carGroup.add(body);

// Hood (slightly angled)
const hood = new THREE.Mesh(box(1.86, 0.12, 1.55), MAT.carBody);
hood.position.set(0, 0.72, 1.38);
hood.rotation.x = -0.07;
hood.castShadow = true; carGroup.add(hood);

// Roof
const roof = new THREE.Mesh(box(1.52, 0.18, 1.85), MAT.carRoof);
roof.position.set(0, 1.1, -0.18);
roof.castShadow = true; carGroup.add(roof);

// A-pillars (front window frame)
[[-0.74, 1.0, 0.78], [0.74, 1.0, 0.78]].forEach(([x, y, z]) => {
  const ap = new THREE.Mesh(box(0.1, 0.5, 0.1), MAT.carBody2);
  ap.position.set(x, y, z); ap.rotation.z = x < 0 ? -0.18 : 0.18;
  carGroup.add(ap);
});

// Front windshield
const windshield = new THREE.Mesh(box(1.5, 0.58, 0.08), MAT.glass);
windshield.position.set(0, 0.92, 0.80); windshield.rotation.x = -0.44;
windshield.castShadow = false; carGroup.add(windshield);

// Rear window
const rearWin = new THREE.Mesh(box(1.38, 0.5, 0.08), MAT.glass);
rearWin.position.set(0, 0.92, -1.10); rearWin.rotation.x = 0.44;
rearWin.castShadow = false; carGroup.add(rearWin);

// Side windows x2
[[-0.98, 0.98, -0.18], [0.98, 0.98, -0.18]].forEach(([x, y, z]) => {
  const sw2 = new THREE.Mesh(box(0.06, 0.42, 1.55), MAT.glassDk);
  sw2.position.set(x, y, z);
  sw2.castShadow = false; carGroup.add(sw2);
});

// Door panels with subtle recess
[[-1.02, 0.5, 0], [1.02, 0.5, 0]].forEach(([x, y, z]) => {
  const dp = new THREE.Mesh(box(0.06, 0.38, 3.2), MAT.carBody2);
  dp.position.set(x, y, z); carGroup.add(dp);
  // Door handle
  const dh = new THREE.Mesh(box(0.04, 0.06, 0.28), MAT.chrome);
  dh.position.set(x, y + 0.04, z + 0.1); carGroup.add(dh);
});

// Front bumper
const fBumper = new THREE.Mesh(box(1.98, 0.22, 0.22), MAT.carBody2);
fBumper.position.set(0, 0.28, 2.42); carGroup.add(fBumper);

// Front grille
const grille = new THREE.Mesh(box(1.4, 0.18, 0.08), MAT.rubber);
grille.position.set(0, 0.3, 2.52); carGroup.add(grille);
// Grille slats
for (let g = -2; g <= 2; g++) {
  const sl = new THREE.Mesh(box(1.35, 0.03, 0.06), MAT.chrome);
  sl.position.set(0, 0.22 + g * 0.04, 2.54); carGroup.add(sl);
}

// Rear bumper
const rBumper = new THREE.Mesh(box(1.98, 0.22, 0.22), MAT.carBody2);
rBumper.position.set(0, 0.28, -2.42); carGroup.add(rBumper);

// Spoiler system
const spoilerWing = new THREE.Mesh(box(1.78, 0.07, 0.52), MAT.carBody);
spoilerWing.position.set(0, 1.05, -2.18); carGroup.add(spoilerWing);
[-0.84, 0.84].forEach(sx => {
  const sp = new THREE.Mesh(box(0.09, 0.52, 0.16), MAT.carBody2);
  sp.position.set(sx, 0.78, -2.15); carGroup.add(sp);
});

// Side skirts
[-1.04, 1.04].forEach(sx => {
  const sk = new THREE.Mesh(box(0.1, 0.12, 4.0), MAT.carBody2);
  sk.position.set(sx, 0.14, 0); carGroup.add(sk);
});

// Headlights (twin each side)
const hlMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.0 });
const hlRimMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });
[[-0.6, 0.44, 2.42], [0.6, 0.44, 2.42]].forEach(([hx, hy, hz]) => {
  // Housing
  const hlHousing = new THREE.Mesh(box(0.46, 0.22, 0.12), hlRimMat);
  hlHousing.position.set(hx, hy, hz); carGroup.add(hlHousing);
  // Main lens
  const hl = new THREE.Mesh(new THREE.CircleGeometry(0.16, 12), MAT.headL);
  hl.position.set(hx, hy, hz + 0.07); carGroup.add(hl);
  // DRL strip
  const drl = new THREE.Mesh(box(0.38, 0.04, 0.06), hlMat);
  drl.position.set(hx, hy - 0.12, hz + 0.06); carGroup.add(drl);
  // Headlight beam
  const spot = new THREE.SpotLight(0xfff8e8, 5.5, 60, Math.PI/10, 0.3, 1.5);
  spot.position.set(hx, hy, hz);
  const tgt = new THREE.Object3D(); tgt.position.set(hx * 1.2, -1.5, 22);
  carGroup.add(tgt); spot.target = tgt; carGroup.add(spot);
});

// Tail lights
[[-0.62, 0.46, -2.38], [0.62, 0.46, -2.38]].forEach(([tx, ty, tz]) => {
  const tlHousing = new THREE.Mesh(box(0.45, 0.22, 0.1), MAT.carBody2);
  tlHousing.position.set(tx, ty, tz); carGroup.add(tlHousing);
  const tl = new THREE.Mesh(box(0.38, 0.16, 0.07), MAT.tailL);
  tl.position.set(tx, ty, tz - 0.04); carGroup.add(tl);
  // Brake light strip
  const brk = new THREE.Mesh(box(0.36, 0.04, 0.06), MAT.tailL);
  brk.position.set(tx, ty + 0.12, tz - 0.04); carGroup.add(brk);
});

// High-mount brake light
const hmb = new THREE.Mesh(box(1.4, 0.06, 0.05), MAT.tailL);
hmb.position.set(0, 1.08, -2.16); carGroup.add(hmb);

// Exhaust pipes
[-0.42, 0.42].forEach(ex => {
  const exhaust = new THREE.Mesh(cyl(0.07, 0.08, 0.22, 10), MAT.chrome);
  exhaust.position.set(ex, 0.18, -2.52); exhaust.rotation.x = Math.PI/2; carGroup.add(exhaust);
  const inner = new THREE.Mesh(cyl(0.055, 0.055, 0.08, 10), MAT.rubber);
  inner.position.set(ex, 0.18, -2.56); inner.rotation.x = Math.PI/2; carGroup.add(inner);
});

// Side mirrors
[-1.05, 1.05].forEach(mx => {
  const mBase = new THREE.Mesh(box(0.06, 0.08, 0.14), MAT.carBody2);
  mBase.position.set(mx, 0.76, 0.82); carGroup.add(mBase);
  const mGlass = new THREE.Mesh(box(0.22, 0.14, 0.06), MAT.glassDk);
  mGlass.position.set(mx < 0 ? mx - 0.1 : mx + 0.1, 0.76, 0.82); carGroup.add(mGlass);
});

// Wheels — highly detailed
const wheelSlots = [
  { p: [ 1.08, 0, 1.72], front: true  },
  { p: [-1.08, 0, 1.72], front: true  },
  { p: [ 1.08, 0,-1.72], front: false },
  { p: [-1.08, 0,-1.72], front: false },
];
const wheelMeshes = [];

for (const ws of wheelSlots) {
  const wg = new THREE.Group();
  wg.position.set(...ws.p);

  // Tire
  const tire = new THREE.Mesh(cyl(0.38, 0.38, 0.29, 20), MAT.tire);
  tire.rotation.z = Math.PI/2;
  tire.castShadow = true; wg.add(tire);

  // Tire sidewall text-like grooves
  const sidewall = new THREE.Mesh(cyl(0.37, 0.37, 0.1, 20), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
  sidewall.rotation.z = Math.PI/2; wg.add(sidewall);

  // Brake disc
  const disc = new THREE.Mesh(cyl(0.28, 0.28, 0.05, 16), new THREE.MeshLambertMaterial({ color: 0x707070 }));
  disc.rotation.z = Math.PI/2; disc.position.x = ws.p[0] > 0 ? -0.06 : 0.06; wg.add(disc);

  // Brake caliper
  const caliper = new THREE.Mesh(box(0.12, 0.22, 0.12), new THREE.MeshLambertMaterial({ color: 0xcc2200 }));
  caliper.position.set(ws.p[0] > 0 ? -0.16 : 0.16, -0.22, 0);
  wg.add(caliper);

  // Rim outer
  const rim = new THREE.Mesh(cyl(0.30, 0.30, 0.31, 16), MAT.rim);
  rim.rotation.z = Math.PI/2; rim.castShadow = true; wg.add(rim);

  // Hub cap
  const hub = new THREE.Mesh(cyl(0.08, 0.08, 0.33, 8), MAT.rimSpoke);
  hub.rotation.z = Math.PI/2; wg.add(hub);

  // Spokes (5 twin-spoke)
  for (let sp = 0; sp < 5; sp++) {
    const angle = (sp/5) * Math.PI * 2;
    for (let side of [-0.05, 0.05]) {
      const spoke = new THREE.Mesh(box(0.06, 0.38, 0.04), MAT.rimSpoke);
      spoke.position.x = side;
      spoke.rotation.z = angle;
      spoke.position.y = Math.sin(angle) * 0.14;
      spoke.position.z = Math.cos(angle) * 0.14;
      wg.add(spoke);
    }
    // Spoke highlight trim
    const trim = new THREE.Mesh(box(0.03, 0.34, 0.03), MAT.chrome);
    trim.rotation.z = angle;
    trim.position.y = Math.sin(angle) * 0.15;
    trim.position.z = Math.cos(angle) * 0.15;
    wg.add(trim);
  }

  carGroup.add(wg);
  wheelMeshes.push({ grp: wg, front: ws.front });
}

carGroup.position.set(ROAD/2, 0.4, ROAD/2);

// ─────────────────────────────────────────────────────────────
// NPC VEHICLES
// ─────────────────────────────────────────────────────────────
const npcList = [];
const npcColorSet = [
  0xcc4422, 0x2255cc, 0x228833, 0xddcc00, 0x884499,
  0xff7700, 0x225588, 0xaa3322, 0x44aa66, 0xccaa00
];

function spawnNPC() {
  const g = new THREE.Group();
  const col = npcColorSet[Math.floor(Math.random() * npcColorSet.length)];
  const npcMat = new THREE.MeshLambertMaterial({ color: col });
  const npcMat2 = new THREE.MeshLambertMaterial({ color: new THREE.Color(col).multiplyScalar(0.8) });

  // Body
  const nb = new THREE.Mesh(box(1.82, 0.42, 4.1), npcMat);
  nb.position.y = 0.32; nb.castShadow = true; g.add(nb);
  // Roof
  const nr = new THREE.Mesh(box(1.55, 0.36, 1.9), npcMat2);
  nr.position.set(0, 0.74, -0.1); nr.castShadow = true; g.add(nr);
  // Windows
  const nfw = new THREE.Mesh(box(1.38, 0.32, 0.06), MAT.glass);
  nfw.position.set(0, 0.72, 0.80); nfw.rotation.x = -0.3; g.add(nfw);
  const nrw = new THREE.Mesh(box(1.28, 0.28, 0.06), MAT.glassDk);
  nrw.position.set(0, 0.72, -1.05); nrw.rotation.x = 0.3; g.add(nrw);
  // Bumpers
  const nfb = new THREE.Mesh(box(1.8, 0.18, 0.18), npcMat2);
  nfb.position.set(0, 0.22, 2.12); g.add(nfb);
  // Headlights
  [-0.55, 0.55].forEach(sx => {
    const hl2 = new THREE.Mesh(new THREE.CircleGeometry(0.12, 8), MAT.headL);
    hl2.position.set(sx, 0.34, 2.12); g.add(hl2);
    const tl2 = new THREE.Mesh(box(0.28, 0.12, 0.06), MAT.tailL);
    tl2.position.set(sx, 0.34, -2.12); g.add(tl2);
  });
  // Wheels
  [[0.93,0,1.28],[-0.93,0,1.28],[0.93,0,-1.28],[-0.93,0,-1.28]].forEach(wp => {
    const tw = new THREE.Group();
    const wt = new THREE.Mesh(cyl(0.30, 0.30, 0.24, 14), MAT.tire); wt.rotation.z = Math.PI/2; tw.add(wt);
    const wr = new THREE.Mesh(cyl(0.22, 0.22, 0.26, 10), MAT.rim); wr.rotation.z = Math.PI/2; tw.add(wr);
    tw.position.set(...wp); g.add(tw);
  });

  const isVert = Math.random() < 0.5;
  const lane   = Math.floor(Math.random() * (GRID + 1));
  const along  = (Math.random() - 0.5) * WORLD;
  const lp     = -HALF + lane * CELL + ROAD / 2 + (Math.random() < 0.5 ? 2.5 : -2.5);
  g.position.set(isVert ? lp : along, 0.32, isVert ? along : lp);
  g.rotation.y = isVert ? 0 : Math.PI / 2;
  const spd2 = (0.06 + Math.random() * 0.12) * (Math.random() < 0.5 ? 1 : -1);
  scene.add(g);
  npcList.push({ g, spd: spd2, isVert, wheelGroups: g.children.filter(c=>c.type==='Group') });
}
for (let i = 0; i < 35; i++) spawnNPC();

// ─────────────────────────────────────────────────────────────
// TYRE SMOKE PARTICLES
// ─────────────────────────────────────────────────────────────
const SMOKE_N = 800;
const smokePos = new Float32Array(SMOKE_N * 3);
const smokeAlpha = new Float32Array(SMOKE_N);
smokePos.fill(9999);
const smokeGeo = new THREE.BufferGeometry();
smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePos, 3));
const smokeMat = new THREE.PointsMaterial({
  color: 0xdddddd, size: 0.6, transparent: true, opacity: 0.45, depthWrite: false, sizeAttenuation: true
});
scene.add(new THREE.Points(smokeGeo, smokeMat));
let smokeIdx = 0;

function puffSmoke(x, z, speed) {
  const n = Math.floor(speed * 4) + 1;
  for (let i = 0; i < n; i++) {
    smokePos[smokeIdx*3  ] = x + (Math.random()-.5) * 0.8;
    smokePos[smokeIdx*3+1] = 0.12 + Math.random() * 0.4;
    smokePos[smokeIdx*3+2] = z + (Math.random()-.5) * 0.8;
    smokeIdx = (smokeIdx + 1) % SMOKE_N;
  }
  smokeGeo.attributes.position.needsUpdate = true;
}

// ─────────────────────────────────────────────────────────────
// PHYSICS STATE
// ─────────────────────────────────────────────────────────────
let carPos    = new THREE.Vector3(ROAD/2, 0.4, ROAD/2);
let carAngle  = 0;
let carSpeed  = 0;
let velX = 0, velZ = 0;
let steer     = 0;
let wheelRot  = 0;
let nitro     = 100;
let driftAmt  = 0;
let totalDist = 0;
let topSpd    = 0;
let score     = 0;
let combo     = 0;
let braking   = false;
let carPitch  = 0;  // nose pitch for smooth ride feel

// Camera lerp state
let camX = 0, camY = 9, camZ = -18;
let camTX = 0, camTY = 0.5, camTZ = 0;
let titleAngle = 0;
let orbitAngle = 0;

// ─────────────────────────────────────────────────────────────
// INPUT
// ─────────────────────────────────────────────────────────────
const keys = {};
document.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'Space') e.preventDefault();
  if (e.code === 'KeyP' && gameStarted) togglePause();
  if (e.code === 'Enter' && !gameStarted) startGame();
  if (e.code === 'KeyC' && gameStarted) cameraMode = (cameraMode + 1) % 3;
  if (e.code === 'KeyL' && gameStarted) lookBack = true;
});
document.addEventListener('keyup', e => {
  keys[e.code] = false;
  if (e.code === 'KeyL') lookBack = false;
});

function pressing(...codes) { return codes.some(c => keys[c]); }

// ─────────────────────────────────────────────────────────────
// COLLISION
// ─────────────────────────────────────────────────────────────
function hitBuilding(nx, nz) {
  for (const b of buildings) {
    if (Math.abs(nx - b.x) < 1.1 + b.hw && Math.abs(nz - b.z) < 2.4 + b.hd) return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────
// PHYSICS STEP — smooth, realistic feel
// ─────────────────────────────────────────────────────────────
function stepPhysics(dt) {
  const up    = pressing('KeyW', 'ArrowUp');
  const dn    = pressing('KeyS', 'ArrowDown');
  const lt    = pressing('KeyA', 'ArrowLeft');
  const rt    = pressing('KeyD', 'ArrowRight');
  const hb    = pressing('Space');
  const boost = pressing('ShiftLeft', 'ShiftRight') && nitro > 0;

  braking = dn && carSpeed > 0;

  // Nitro
  if (boost) nitro = Math.max(0, nitro - dt * 28);
  else       nitro = Math.min(100, nitro + dt * 8.5);

  // Speed limits
  const maxFwd  = boost ? 0.88 : 0.58;
  const maxBwd  = -0.30;
  const accel   = boost ? 0.030 : 0.019;
  const brakeF  = 0.032;
  const coastF  = hb ? 0.93 : 0.977;

  if (up) {
    carSpeed = Math.min(carSpeed + accel, maxFwd);
  } else if (dn) {
    if (carSpeed > 0.005)  carSpeed = Math.max(carSpeed - brakeF, 0);
    else                   carSpeed = Math.max(carSpeed - accel * 0.7, maxBwd);
  } else {
    carSpeed *= coastF;
    if (Math.abs(carSpeed) < 0.0008) carSpeed = 0;
  }

  // Steering — speed-sensitive (less turn at high speed)
  const maxSteer = 0.055 * Math.max(0.45, 1.0 - Math.abs(carSpeed) / maxFwd * 0.55);
  const steerRate = 0.006;
  if (lt)        steer = Math.min(steer + steerRate, maxSteer);
  else if (rt)   steer = Math.max(steer - steerRate, -maxSteer);
  else           steer *= 0.84;

  // Yaw
  const handbrake = hb ? 1.65 : 1.0;
  carAngle += carSpeed * steer * 62 * handbrake;

  // Velocity & drift
  const targetVX = Math.sin(carAngle) * carSpeed;
  const targetVZ = Math.cos(carAngle) * carSpeed;
  const gripFactor = hb ? 0.68 : 0.88;
  velX = velX * (1 - gripFactor) + targetVX * gripFactor;
  velZ = velZ * (1 - gripFactor) + targetVZ * gripFactor;

  driftAmt = Math.hypot(velX - targetVX, velZ - targetVZ);

  // Smoke
  if (driftAmt > 0.03 || (hb && Math.abs(carSpeed) > 0.06)) {
    puffSmoke(carPos.x - velX * 2.2, carPos.z - velZ * 2.2, driftAmt * 8 + 0.5);
    score += driftAmt * 20;
    combo = Math.min(combo + 1, 200);
  } else {
    combo = Math.max(0, combo - 2);
  }

  // Also smoke on hard brake
  if (braking && carSpeed > 0.25) {
    puffSmoke(carPos.x - velX * 1.5, carPos.z - velZ * 1.5, 0.5);
  }

  // Move & collide
  const nx = carPos.x + velX;
  const nz = carPos.z + velZ;

  if (!hitBuilding(nx, nz)) {
    carPos.x = nx; carPos.z = nz;
  } else if (!hitBuilding(carPos.x + velX, carPos.z)) {
    carPos.x += velX; carSpeed *= 0.22; velZ *= -0.08;
  } else if (!hitBuilding(carPos.x, carPos.z + velZ)) {
    carPos.z += velZ; carSpeed *= 0.22; velX *= -0.08;
  } else {
    carSpeed *= -0.1; velX *= -0.06; velZ *= -0.06;
  }

  // World wrap
  const W2 = HALF - 2;
  if (carPos.x > W2)  carPos.x = -W2 + 4;
  if (carPos.x < -W2) carPos.x =  W2 - 4;
  if (carPos.z > W2)  carPos.z = -W2 + 4;
  if (carPos.z < -W2) carPos.z =  W2 - 4;

  const kmh = Math.abs(carSpeed) * 200;
  totalDist += Math.hypot(velX, velZ) * 2.2;
  if (kmh > topSpd) topSpd = kmh;
  wheelRot += carSpeed * 9.5;

  // Visual pitch/roll
  const targetPitch = carSpeed * 1.2;
  carPitch += (targetPitch - carPitch) * 0.1;

  // Apply transforms
  carGroup.position.copy(carPos);
  carGroup.rotation.y = carAngle;
  carGroup.rotation.z = -driftAmt * 1.5 * Math.sign(steer) * (1 / Math.max(0.3, 1 + Math.abs(driftAmt)));
  carGroup.rotation.x = carPitch;

  for (const w of wheelMeshes) {
    if (w.front) w.grp.rotation.y = steer * 6.5;
    w.grp.children[0].rotation.x = wheelRot;  // tire
    w.grp.children[1].rotation.x = wheelRot;  // sidewall
    w.grp.children[3].rotation.x = wheelRot;  // rim
  }
}

// ─────────────────────────────────────────────────────────────
// NPC STEP
// ─────────────────────────────────────────────────────────────
function stepNPCs(dt) {
  for (const n of npcList) {
    if (n.isVert) {
      n.g.position.z += n.spd;
      if (n.g.position.z >  HALF) n.g.position.z = -HALF;
      if (n.g.position.z < -HALF) n.g.position.z =  HALF;
    } else {
      n.g.position.x += n.spd;
      if (n.g.position.x >  HALF) n.g.position.x = -HALF;
      if (n.g.position.x < -HALF) n.g.position.x =  HALF;
    }
    // Spin NPC wheels
    n.g.children.forEach(child => {
      if (child.type === 'Group') {
        child.children.forEach(c => { c.rotation.x += n.spd * 8; });
      }
    });
  }
}

// ─────────────────────────────────────────────────────────────
// CAMERA STEP — 3 modes: chase, hood, orbit
// ─────────────────────────────────────────────────────────────
function stepCamera() {
  const sp = Math.abs(carSpeed);
  const isLookBack = lookBack || pressing('KeyL');

  if (cameraMode === 0) {
    // Chase cam — smooth follow with lag
    const back  = isLookBack ? -8 : 13 + sp * 10;
    const height= isLookBack ? 3.5 : 5.5 + sp * 3.5;
    const fwdX  = Math.sin(carAngle) * back;
    const fwdZ  = Math.cos(carAngle) * back;
    const tCX   = carPos.x - fwdX;
    const tCY   = height;
    const tCZ   = carPos.z - fwdZ;
    const lerpS = 0.08 + sp * 0.04;
    camX += (tCX - camX) * lerpS;
    camY += (tCY - camY) * lerpS;
    camZ += (tCZ - camZ) * lerpS;
    camera.position.set(camX, camY, camZ);
    const lookFwd = isLookBack ? 5 : 2.5;
    camTX += (carPos.x + Math.sin(carAngle) * lookFwd - camTX) * 0.12;
    camTY += (0.7 - camTY) * 0.12;
    camTZ += (carPos.z + Math.cos(carAngle) * lookFwd - camTZ) * 0.12;
    camera.lookAt(camTX, camTY, camTZ);
  } else if (cameraMode === 1) {
    // Hood / dash cam
    const hoodX = carPos.x + Math.sin(carAngle) * 1.5;
    const hoodZ = carPos.z + Math.cos(carAngle) * 1.5;
    camera.position.set(hoodX, carPos.y + 1.05, hoodZ);
    camera.lookAt(
      carPos.x + Math.sin(carAngle) * 20,
      carPos.y + 0.9,
      carPos.z + Math.cos(carAngle) * 20
    );
  } else {
    // Orbit cam — cinematic
    orbitAngle += 0.008;
    const orbitR = 18 + sp * 8;
    camera.position.set(
      carPos.x + Math.cos(orbitAngle) * orbitR,
      8 + sp * 3,
      carPos.z + Math.sin(orbitAngle) * orbitR
    );
    camera.lookAt(carPos.x, carPos.y + 1, carPos.z);
  }

  camera.fov = 62 + sp * 8;
  camera.updateProjectionMatrix();
}

// ─────────────────────────────────────────────────────────────
// AUDIO ENGINE
// ─────────────────────────────────────────────────────────────
let audioCtx, engOsc, engOsc2, engGain, audioReady = false;

function initAudio() {
  if (audioReady) return;
  audioReady = true;
  audioCtx  = new (window.AudioContext || window.webkitAudioContext)();

  // Primary oscillator
  engOsc = audioCtx.createOscillator();
  engOsc.type = 'sawtooth';
  engOsc.frequency.value = 90;

  // Second osc for richness
  engOsc2 = audioCtx.createOscillator();
  engOsc2.type = 'square';
  engOsc2.frequency.value = 45;

  // Waveshaper distortion
  const dist = audioCtx.createWaveShaper();
  const cv = new Float32Array(512);
  for (let i = 0; i < 512; i++) {
    const x = i * 2 / 512 - 1;
    cv[i] = (Math.PI + 280) * x / (Math.PI + 280 * Math.abs(x));
  }
  dist.curve = cv;

  const filt = audioCtx.createBiquadFilter();
  filt.type = 'bandpass'; filt.frequency.value = 500; filt.Q.value = 0.8;

  const filt2 = audioCtx.createBiquadFilter();
  filt2.type = 'lowpass'; filt2.frequency.value = 900;

  engGain = audioCtx.createGain();
  engGain.gain.value = 0;

  const gain2 = audioCtx.createGain();
  gain2.gain.value = 0.45;

  engOsc.connect(dist); dist.connect(filt); filt.connect(engGain);
  engOsc2.connect(filt2); filt2.connect(gain2); gain2.connect(engGain);
  engGain.connect(audioCtx.destination);
  engOsc.start(); engOsc2.start();
}

function stepAudio() {
  if (!audioReady) return;
  const sp  = Math.abs(carSpeed);
  const nb  = pressing('ShiftLeft', 'ShiftRight') ? 150 : 0;
  const tgt = 88 + sp * 380 + nb;
  engOsc.frequency.setTargetAtTime(tgt, audioCtx.currentTime, 0.07);
  engOsc2.frequency.setTargetAtTime(tgt * 0.5, audioCtx.currentTime, 0.07);
  engGain.gain.setTargetAtTime(0.015 + sp * 0.085, audioCtx.currentTime, 0.07);
}

// ─────────────────────────────────────────────────────────────
// ANIMATE WORLD
// ─────────────────────────────────────────────────────────────
let worldTime = 0;
function animateWorld(dt) {
  worldTime += dt;
  // Drift clouds slowly
  for (const c of clouds) {
    c.position.x += c.userData.speed * dt;
    if (c.position.x > 700)  c.position.x = -700;
    if (c.position.x < -700) c.position.x =  700;
    // Gentle bobbing
    c.position.y += Math.sin(worldTime * 0.2 + c.position.z * 0.01) * dt * 0.3;
  }
  // Subtle sky follow camera
  skyMesh.position.copy(camera.position);
}

// ─────────────────────────────────────────────────────────────
// HUD — clean daylight theme
// ─────────────────────────────────────────────────────────────
let driftFlash = 0;
const MAXKMH = 280;

function drawHUD() {
  const W = hudCanvas.width, H = hudCanvas.height;
  hud.clearRect(0, 0, W, H);

  const kmh = Math.abs(carSpeed) * 200;
  const sf  = Math.min(kmh / MAXKMH, 1);

  // ── SPEEDOMETER ──
  const sx = W - 148, sy = H - 148, sr = 90;
  const a0 = Math.PI * 0.76, a1 = Math.PI * 2.24;

  // Outer glow
  const gl = hud.createRadialGradient(sx, sy, 0, sx, sy, sr + 14);
  gl.addColorStop(0, 'rgba(255,200,80,0.08)');
  gl.addColorStop(1, 'rgba(0,0,0,0)');
  hud.beginPath(); hud.arc(sx, sy, sr + 16, 0, Math.PI*2);
  hud.fillStyle = gl; hud.fill();

  // Dark bg
  hud.beginPath(); hud.arc(sx, sy, sr, 0, Math.PI*2);
  hud.fillStyle = 'rgba(10,12,18,0.80)'; hud.fill();
  hud.strokeStyle = 'rgba(255,200,80,0.25)'; hud.lineWidth = 1.5; hud.stroke();

  // Track
  hud.beginPath(); hud.arc(sx, sy, sr - 10, a0, a1);
  hud.strokeStyle = 'rgba(255,255,255,0.07)'; hud.lineWidth = 7; hud.stroke();

  // Speed arc
  const arcColor = nitro < 15 && pressing('ShiftLeft','ShiftRight')
    ? '#ff4400'
    : kmh > 210 ? '#ff3355'
    : kmh > 140 ? '#ffaa00'
    : '#f5a623';
  hud.beginPath(); hud.arc(sx, sy, sr - 10, a0, a0 + sf * (a1 - a0));
  hud.strokeStyle = arcColor; hud.lineWidth = 7; hud.stroke();

  // Tick marks
  for (let i = 0; i <= 14; i++) {
    const a  = a0 + (i/14) * (a1 - a0);
    const r1 = sr - 17;
    const r2 = i % 7 === 0 ? sr - 33 : (i % 7 === 0 ? sr - 27 : sr - 24);
    hud.beginPath();
    hud.moveTo(sx + Math.cos(a)*r1, sy + Math.sin(a)*r1);
    hud.lineTo(sx + Math.cos(a)*r2, sy + Math.sin(a)*r2);
    hud.strokeStyle = i % 7 === 0 ? 'rgba(255,255,255,.6)' : 'rgba(255,255,255,.2)';
    hud.lineWidth   = i % 7 === 0 ? 2 : 0.9; hud.stroke();
  }

  // Needle
  const na = a0 + sf * (a1 - a0);
  const nlx = sx + Math.cos(na) * (sr - 20);
  const nly = sy + Math.sin(na) * (sr - 20);
  const nbx = sx + Math.cos(na + Math.PI) * 14;
  const nby = sy + Math.sin(na + Math.PI) * 14;
  hud.beginPath(); hud.moveTo(nbx, nby); hud.lineTo(nlx, nly);
  hud.strokeStyle = '#fff'; hud.lineWidth = 2.2; hud.stroke();
  hud.beginPath(); hud.arc(sx, sy, 5, 0, Math.PI*2);
  hud.fillStyle = '#f5a623'; hud.fill();

  // Speed number
  hud.font = 'bold 30px Orbitron, monospace';
  hud.textAlign = 'center'; hud.fillStyle = '#ffffff';
  hud.fillText(Math.round(kmh), sx, sy + 9);
  hud.font = '9px Barlow Condensed, monospace';
  hud.fillStyle = 'rgba(255,255,255,.4)';
  hud.fillText('KM/H', sx, sy + 24);

  // Gear
  const gear = Math.min(6, Math.floor(sf * 6) + 1);
  hud.font = 'bold 14px Orbitron, monospace';
  hud.fillStyle = 'rgba(245,166,35,0.7)';
  hud.fillText('G' + gear, sx, sy - 22);

  // ── NITRO BAR ──
  const nbX = W - 238, nbY = H - 34, nbW = 148, nbH = 7;
  hud.fillStyle = 'rgba(0,0,0,0.65)';
  hud.fillRect(nbX - 2, nbY - 2, nbW + 4, nbH + 4);
  const ng = hud.createLinearGradient(nbX, 0, nbX + nbW, 0);
  ng.addColorStop(0, '#00ddff');
  ng.addColorStop(0.5, '#aaff00');
  ng.addColorStop(1, '#ff8800');
  hud.fillStyle = ng;
  hud.fillRect(nbX, nbY, nbW * (nitro / 100), nbH);
  hud.font = '9px Barlow Condensed, monospace';
  hud.textAlign = 'left';
  hud.fillStyle = 'rgba(255,255,255,.3)';
  hud.fillText('NITRO', nbX, nbY - 4);

  // ── MINIMAP ──
  const mmX = W - 136, mmY = 16, mmS = 118;
  const ms  = mmS / WORLD;
  hud.fillStyle = 'rgba(10,12,18,0.75)';
  hud.fillRect(mmX, mmY, mmS, mmS);

  // Inset shadow
  hud.strokeStyle = 'rgba(255,200,80,0.2)';
  hud.lineWidth = 1; hud.strokeRect(mmX, mmY, mmS, mmS);

  // Roads on minimap
  hud.fillStyle = 'rgba(55,55,55,0.9)';
  for (let i = 0; i <= GRID; i++) {
    const p = -HALF + i * CELL;
    const rx = mmX + (p + HALF) * ms;
    hud.fillRect(rx, mmY, ROAD * ms, mmS);
    hud.fillRect(mmX, mmY + (p + HALF) * ms, mmS, ROAD * ms);
  }

  // Buildings
  hud.fillStyle = 'rgba(100,90,80,0.7)';
  for (const b of buildings) {
    hud.fillRect(mmX+(b.x-b.hw+HALF)*ms, mmY+(b.z-b.hd+HALF)*ms, b.hw*2*ms, b.hd*2*ms);
  }

  // NPCs
  hud.fillStyle = '#ffaa44';
  for (const n of npcList) {
    hud.fillRect(mmX + (n.g.position.x + HALF)*ms - 1.5, mmY + (n.g.position.z + HALF)*ms - 1.5, 3, 3);
  }

  // Player dot
  const pmx = mmX + (carPos.x + HALF) * ms;
  const pmz = mmY + (carPos.z + HALF) * ms;
  hud.save();
  hud.translate(pmx, pmz);
  hud.rotate(carAngle);
  hud.fillStyle = '#f5a623';
  hud.beginPath(); hud.moveTo(0, -5.5); hud.lineTo(3.2, 4); hud.lineTo(-3.2, 4); hud.closePath();
  hud.fill();
  hud.restore();
  hud.font = '8px Barlow Condensed, monospace';
  hud.textAlign = 'center'; hud.fillStyle = 'rgba(245,166,35,0.4)';
  hud.fillText('MAP', mmX + mmS/2, mmY + mmS + 13);

  // ── TOP-LEFT STATS ──
  const statRows = [
    ['SPEED',  `${Math.round(kmh)} km/h`,        '#f5a623'],
    ['TOP',    `${Math.round(topSpd)} km/h`,      '#cccccc'],
    ['DIST',   `${(totalDist/1000).toFixed(2)} km`, '#cccccc'],
    ['SCORE',  score.toFixed(0),                  '#ffdd44'],
  ];
  statRows.forEach(([label, val, col], i) => {
    const ry = 16 + i * 26;
    hud.fillStyle = 'rgba(10,12,18,0.6)';
    hud.fillRect(14, ry, 148, 22);
    hud.strokeStyle = 'rgba(255,200,80,0.12)'; hud.lineWidth = 0.5;
    hud.strokeRect(14, ry, 148, 22);
    hud.font = '11px Barlow Condensed, monospace';
    hud.textAlign = 'left';
    hud.fillStyle = 'rgba(255,255,255,.3)';
    hud.fillText(label, 22, ry + 15);
    hud.textAlign = 'right';
    hud.fillStyle = col;
    hud.fillText(val, 157, ry + 15);
  });

  // ── CAMERA MODE INDICATOR ──
  const camNames = ['CHASE CAM', 'HOOD CAM', 'ORBIT CAM'];
  hud.textAlign = 'left'; hud.font = '10px Barlow Condensed, monospace';
  hud.fillStyle = 'rgba(245,166,35,0.4)';
  hud.fillText('[ C ] ' + camNames[cameraMode], 14, H - 30);

  // ── DRIFT FLASH ──
  if (driftAmt > 0.03) {
    driftFlash += 0.15;
    const alpha = 0.6 + 0.4 * Math.sin(driftFlash * 6);
    hud.textAlign = 'center';
    hud.font = 'bold 26px Orbitron, monospace';
    hud.fillStyle = `rgba(255,140,0,${alpha})`;
    hud.shadowColor = '#ff8800'; hud.shadowBlur = 22;
    hud.fillText('✦ DRIFT ✦', W/2, H - 75);
    hud.shadowBlur = 0;
    if (combo > 10) {
      hud.font = 'bold 14px Barlow Condensed, monospace';
      hud.fillStyle = `rgba(255,220,0,${alpha * 0.9})`;
      hud.fillText('COMBO ×' + combo, W/2, H - 48);
    }
  } else { driftFlash = 0; }

  // ── NITRO BOOST FLASH ──
  if (pressing('ShiftLeft','ShiftRight') && nitro > 0) {
    hud.textAlign = 'center';
    hud.font = 'bold 15px Orbitron, monospace';
    const fl = 0.6 + 0.4 * Math.sin(Date.now() * 0.022);
    hud.fillStyle = `rgba(255,100,0,${fl})`;
    hud.shadowColor = '#ff6600'; hud.shadowBlur = 18;
    hud.fillText('◆ NITRO BOOST ◆', W/2, 44);
    hud.shadowBlur = 0;
  }

  // ── LOOK BACK INDICATOR ──
  if (lookBack) {
    hud.textAlign = 'center';
    hud.font = 'bold 11px Orbitron, monospace';
    hud.fillStyle = 'rgba(255,200,80,0.6)';
    hud.fillText('◀ LOOKING BACK ▶', W/2, 70);
  }

  // ── BRAKE INDICATOR ──
  if (braking) {
    hud.textAlign = 'right';
    hud.font = 'bold 12px Orbitron, monospace';
    hud.fillStyle = 'rgba(255,60,30,0.7)';
    hud.fillText('BRAKE', W - 14, H - 55);
  }
}

// ─────────────────────────────────────────────────────────────
// PAUSE
// ─────────────────────────────────────────────────────────────
const pauseOverlay = document.getElementById('pauseOverlay');
function togglePause() {
  gamePaused = !gamePaused;
  pauseOverlay.style.display = gamePaused ? 'flex' : 'none';
}

// ─────────────────────────────────────────────────────────────
// MAIN LOOP
// ─────────────────────────────────────────────────────────────
let lastT = 0;
function loop(t) {
  requestAnimationFrame(loop);
  const dt = Math.min((t - lastT) / 1000, 0.05);
  lastT = t;

  if (!gameStarted || gamePaused) {
    renderer.render(scene, camera);
    return;
  }

  stepPhysics(dt);
  stepNPCs(dt);
  stepCamera();
  stepAudio();
  animateWorld(dt);
  renderer.render(scene, camera);
  drawHUD();
}

// Title camera spin
(function titleSpin(t) {
  if (gameStarted) return;
  requestAnimationFrame(titleSpin);
  titleAngle += 0.0018;
  camera.position.set(
    Math.sin(titleAngle) * 42,
    16,
    Math.cos(titleAngle) * 42
  );
  camera.lookAt(0, 4, 0);
  renderer.render(scene, camera);
})();

requestAnimationFrame(loop);

// ─────────────────────────────────────────────────────────────
// START GAME
// ─────────────────────────────────────────────────────────────
function startGame() {
  if (gameStarted) return;
  gameStarted = true;
  initAudio();
  const ts = document.getElementById('titleScreen');
  ts.style.transition = 'opacity 0.85s ease';
  ts.style.opacity = '0';
  ts.style.pointerEvents = 'none';
  setTimeout(() => ts.style.display = 'none', 900);
  // Reset camera lerp to behind car
  camX = carPos.x - Math.sin(carAngle) * 14;
  camY = 8;
  camZ = carPos.z - Math.cos(carAngle) * 14;
  camTX = carPos.x; camTY = 0.5; camTZ = carPos.z;
}

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('titleScreen').addEventListener('click', startGame);
