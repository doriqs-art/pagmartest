'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import LogoBlur from '@/components/LogoBlur';
import * as sound from '@/lib/sound';

const PHOTOS = [
  '/poppy/Belgian_Shepherd_Corgi_mix_dog_202606071745.jpeg',
  '/poppy/Belgian_Shepherd_Corgi_mix_dog_202606071747.jpeg',
  '/poppy/Belgian_Shepherd_Corgi_mix_run_202606071747.jpeg',
  '/poppy/Dog_looking_under_picnic_table_202606071745.jpeg',
  '/poppy/Dog_running_on_pebbled_beach_202606071747.jpeg',
  '/poppy/Dog_running_through_park_202606071745.jpeg',
  '/poppy/Dog_searching_near_tree_roots_202606071745.jpeg',
  '/poppy/Dog_splashing_in_forest_stream_202606071747.jpeg',
];
const VIDEOS = [
  '/poppy/Belgian_Shepherd_Corgi_mix_dog_202606071751.mp4',
  '/poppy/Dog_finds_purple_ball_202606071753.mp4',
  '/poppy/Dog_running_mountain_meadow_202606071755.mp4',
  '/poppy/Dog_running_park_finding_ball_202606071742.mp4',
  '/poppy/Dog_running_through_park_202606071750.mp4',
];

const BG = 0x0c0c0c;

const TILE_COUNT = 40;
const RADIUS = 4.25;
const PHOTO_SIZE = 0.82;
const VIDEO_W = 0.98;
const VIDEO_H = 0.62;
const RECORDING_R = 0.42;
const Y_SQUASH = 0.92;
const MAX_PITCH = 0.9;
const DRAG_TO_ANGLE = 0.003;
const SPIN_DAMPING = 0.92;
const IDLE_SPIN = 0.12;

const CENTER_MODEL = '/models/dog_head_simple_model.glb';
const CENTER_SIZE = 2.4;

const GRID_CELL = 18 / 28;

const TILE_KINDS = ['photo', 'video', 'recording'] as const;
type TileKind = (typeof TILE_KINDS)[number];

const CARD_TIME: CSSProperties = {
  flex: 'none',
  fontFamily: 'var(--font-michroma), sans-serif',
  fontSize: '0.7rem',
  color: 'rgba(255,255,255,0.6)',
};

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function makeTileTexture(kind: TileKind): THREE.CanvasTexture {
  const W = 360;
  const H = 500;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#191919';
  roundRectPath(ctx, 6, 6, W - 12, H - 12, 28);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.stroke();

  const cx = W / 2;
  const cy = H / 2;
  const ink = 'rgba(232,232,238,0.88)';
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (kind === 'photo') {
    const fw = 156;
    const fh = 124;
    const fx = cx - fw / 2;
    const fy = cy - fh / 2;
    ctx.lineWidth = 7;
    roundRectPath(ctx, fx, fy, fw, fh, 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(fx + fw * 0.72, fy + fh * 0.3, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(fx + 10, fy + fh - 10);
    ctx.lineTo(fx + fw * 0.4, fy + fh * 0.46);
    ctx.lineTo(fx + fw * 0.6, fy + fh * 0.72);
    ctx.lineTo(fx + fw * 0.78, fy + fh * 0.52);
    ctx.lineTo(fx + fw - 10, fy + fh - 10);
    ctx.stroke();
  } else if (kind === 'video') {
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(cx, cy, 60, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 18, cy - 28);
    ctx.lineTo(cx - 18, cy + 28);
    ctx.lineTo(cx + 32, cy);
    ctx.closePath();
    ctx.fill();
  } else {
    const heights = [26, 48, 74, 42, 96, 124, 96, 42, 74, 48, 26];
    const bw = 8;
    const gap = 15;
    const total = heights.length * bw + (heights.length - 1) * gap;
    let x = cx - total / 2;
    for (const hh of heights) {
      roundRectPath(ctx, x, cy - hh / 2, bw, hh, bw / 2);
      ctx.fill();
      x += bw + gap;
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeVideoTileTexture(posterUrl: string): THREE.CanvasTexture {
  const W = 480;
  const H = 300;
  const R = 30;
  const FRAME = 16;
  const IR = Math.max(8, R - FRAME);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;

  const paintGlass = () => {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    roundRectPath(ctx, 0.75, 0.75, W - 1.5, H - 1.5, R);
    ctx.fillStyle = 'rgba(16,17,22,0.78)';
    ctx.fill();
    const sheen = ctx.createLinearGradient(0, 0, W, H);
    sheen.addColorStop(0, 'rgba(255,255,255,0.18)');
    sheen.addColorStop(0.52, 'rgba(255,255,255,0)');
    sheen.addColorStop(1, 'rgba(255,255,255,0.12)');
    ctx.fillStyle = sheen;
    ctx.fill();
    ctx.restore();
  };
  paintGlass();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;

  const drawFrame = () => {
    ctx.save();
    roundRectPath(ctx, 0.75, 0.75, W - 1.5, H - 1.5, R);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(R, 1.5);
    ctx.lineTo(W - R, 1.5);
    ctx.stroke();
    ctx.restore();
    roundRectPath(ctx, 0.75, 0.75, W - 1.5, H - 1.5, R);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.stroke();
  };

  const drawPlay = (strong: boolean) => {
    const cx = W / 2;
    const cy = H / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 46, 0, Math.PI * 2);
    ctx.fillStyle = strong ? 'rgba(0,0,0,0.35)' : 'transparent';
    if (strong) ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = strong ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.6)';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 14, cy - 20);
    ctx.lineTo(cx - 14, cy + 20);
    ctx.lineTo(cx + 24, cy);
    ctx.closePath();
    ctx.fillStyle = strong ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.6)';
    ctx.fill();
  };

  const img = new Image();
  img.onload = () => {
    const dx = FRAME;
    const dy = FRAME;
    const dw = W - FRAME * 2;
    const dh = H - FRAME * 2;
    ctx.save();
    roundRectPath(ctx, dx, dy, dw, dh, IR);
    ctx.clip();
    const ar = img.width / img.height;
    const tar = dw / dh;
    let sw: number;
    let sh: number;
    let sx: number;
    let sy: number;
    if (ar > tar) {
      sh = img.height;
      sw = sh * tar;
      sx = (img.width - sw) / 2;
      sy = 0;
    } else {
      sw = img.width;
      sh = sw / tar;
      sx = 0;
      sy = (img.height - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(dx, dy, dw, dh);
    ctx.restore();
    drawFrame();
    drawPlay(true);
    tex.needsUpdate = true;
  };
  img.onerror = () => {
    drawFrame();
    drawPlay(false);
    tex.needsUpdate = true;
  };
  img.src = posterUrl;
  return tex;
}

function makeRecordingCircleTexture(): THREE.CanvasTexture {
  const S = 360;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#1c1c1c';
  ctx.fillRect(0, 0, S, S);
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S / 2 - 6, 0, Math.PI * 2);
  ctx.stroke();

  const cx = S / 2;
  const cy = S / 2;
  const heights = [40, 70, 112, 70, 152, 192, 152, 70, 112, 70, 40];
  const bw = 10;
  const gap = 12;
  const total = heights.length * bw + (heights.length - 1) * gap;
  let x = cx - total / 2;
  ctx.fillStyle = 'rgba(232,232,238,0.86)';
  for (const hh of heights) {
    roundRectPath(ctx, x, cy - hh / 2, bw, hh, bw / 2);
    ctx.fill();
    x += bw + gap;
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export default function GalleryScreen({ photoUrl, name }: { photoUrl: string | null; name?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drive = useRef({
    angleX: 0,
    angleY: 0,
    velX: 0,
    velY: 0,
    dragging: false,
    lastX: 0,
    lastY: 0,
    lastT: 0,
    moved: 0,
    pointerId: -1,
  });
  const hover = useRef({ active: false, x: 0, y: 0, ease: 0 });
  const labelRef = useRef<HTMLDivElement>(null);
  const [opened, setOpened] = useState<{ id: number; kind: TileKind; src: string | null } | null>(null);
  const openRef = useRef(false);
  useEffect(() => {
    openRef.current = opened !== null;
  }, [opened]);

  const [preserved, setPreserved] = useState<number[]>([]);
  const preservedRef = useRef<number[]>([]);
  useEffect(() => {
    preservedRef.current = preserved;
  }, [preserved]);
  const [filtered, setFiltered] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [vCur, setVCur] = useState(0);
  const [vDur, setVDur] = useState(0);
  const toggleVideo = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  };
  const seekVideo = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v || !vDur) return;
    const rect = e.currentTarget.getBoundingClientRect();
    v.currentTime = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)) * vDur;
  };
  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
  useEffect(() => {
    setIsPlaying(false);
    setVCur(0);
    setVDur(0);
  }, [opened]);

  useEffect(() => {
    sound.setCalm(true);
    return () => sound.setCalm(false);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(BG);

    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.7);
    keyLight.position.set(3, 5, 4);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0xe85d35, 0.7);
    rimLight.position.set(-4, 1, -3);
    scene.add(rimLight);

    let W = window.innerWidth;
    let H = window.innerHeight;
    const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 1000);
    camera.position.set(0, 0, 6.5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const disposables: Array<{ dispose: () => void }> = [];

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2(-2, -2);
    const tiles: THREE.Mesh[] = [];

    const gridUniforms = {
      uGridScale: { value: new THREE.Vector2(28.0, 28.0) },
      uLineWidth: { value: 0.5 },
      uEdgeWidth: { value: 0.14 },
      uEdgeAmp: { value: 1.35 },
      uCenterRadius: { value: 0.22 },
      uCenterAmp: { value: 0.9 },
      uCenter: { value: new THREE.Vector2(0.5, 0.5) },
      uTime: { value: 0 },
      uScrollSpeed: { value: 0.01 },
    };
    const gridGeo = new THREE.PlaneGeometry(1, 1, 200, 200);
    const gridMat = new THREE.ShaderMaterial({
      uniforms: gridUniforms,
      side: THREE.DoubleSide,
      vertexShader: `
        varying vec2 vUv;
        uniform float uEdgeWidth; uniform float uEdgeAmp;
        uniform float uCenterRadius; uniform float uCenterAmp; uniform vec2 uCenter;
        void main() {
          vUv = uv;
          vec3 p = position;
          float dEdge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
          float edgeMask = 1.0 - smoothstep(0.0, uEdgeWidth, dEdge);
          float dCenter = distance(vUv, uCenter);
          float centerMask = 1.0 - smoothstep(0.0, uCenterRadius, dCenter);
          p.z += edgeMask * uEdgeAmp + centerMask * uCenterAmp;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform vec2 uGridScale; uniform float uLineWidth; uniform float uTime; uniform float uScrollSpeed;
        float gridLine(float coord, float width) {
          float fw = fwidth(coord);
          float p = abs(fract(coord - 0.5) - 0.5);
          return 1.0 - smoothstep(width * fw, (width + 1.0) * fw, p);
        }
        void main() {
          vec2 uv = (vUv + vec2(uTime * uScrollSpeed, 0.0)) * uGridScale;
          float g = max(gridLine(uv.x, uLineWidth), gridLine(uv.y, uLineWidth));
          vec3 col = mix(vec3(0.075), vec3(0.16), g);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const grid = new THREE.Mesh(gridGeo, gridMat);
    grid.position.z = -5.2;
    scene.add(grid);
    disposables.push(gridGeo, gridMat);

    const sizeGrid = () => {
      const dist = camera.position.z - grid.position.z;
      const visH = 2 * dist * Math.tan((camera.fov * Math.PI) / 360);
      const visW = visH * camera.aspect;
      const sx = visW * 1.12;
      const sy = visH * 1.12;
      grid.scale.set(sx, sy, 1);
      gridUniforms.uGridScale.value.set(sx / GRID_CELL, sy / GRID_CELL);
    };
    sizeGrid();

    const sphere = new THREE.Group();
    scene.add(sphere);
    const centreTarget = new THREE.Vector3(0, 0, 0);
    let center: THREE.Group | null = null;
    let ready = false;

    const photoGeo = new THREE.PlaneGeometry(PHOTO_SIZE, PHOTO_SIZE);
    const videoGeo = new THREE.PlaneGeometry(VIDEO_W, VIDEO_H);
    disposables.push(photoGeo, videoGeo);
    const texLoader = new THREE.TextureLoader();

    const photoUrls = (photoUrl ? [photoUrl] : []).concat(PHOTOS);
    const photoMats = photoUrls.map((url) => {
      const tex = texLoader.load(url, (t) => {
        const im = t.image as { width: number; height: number };
        const ar = im.width / im.height;
        if (ar > 1) {
          t.repeat.set(1 / ar, 1);
          t.offset.set((1 - 1 / ar) / 2, 0);
        } else {
          t.repeat.set(1, ar);
          t.offset.set(0, (1 - ar) / 2);
        }
        t.needsUpdate = true;
      });
      tex.colorSpace = THREE.SRGBColorSpace;
      disposables.push(tex);
      const m = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, toneMapped: false });
      disposables.push(m);
      return m;
    });

    const placeholderMat = (k: TileKind) => {
      const tex = makeTileTexture(k);
      disposables.push(tex);
      const m = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, toneMapped: false });
      disposables.push(m);
      return m;
    };
    const posterFor = (v: string) => '/poppy/posters/' + (v.split('/').pop() ?? '').replace(/\.mp4$/i, '.jpg');
    const videoMats = VIDEOS.map((v) => {
      const tex = makeVideoTileTexture(posterFor(v));
      disposables.push(tex);
      const m = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, toneMapped: false, transparent: true });
      disposables.push(m);
      return m;
    });
    const recordingGeo = new THREE.CircleGeometry(RECORDING_R, 48);
    const recordingTex = makeRecordingCircleTexture();
    const recordingMat = new THREE.MeshBasicMaterial({ map: recordingTex, side: THREE.DoubleSide, toneMapped: false });
    disposables.push(recordingGeo, recordingTex, recordingMat);
    const photoFallbackMat = photoMats.length ? null : placeholderMat('photo');
    const videoFallbackMat = videoMats.length ? null : placeholderMat('video');

    type Meta = { id: number; kind: TileKind; src: string | null; mat: THREE.MeshBasicMaterial; geo: THREE.BufferGeometry };
    const meta: Meta[] = [];
    let pIdx = 0;
    let vIdx = 0;
    const KIND_PATTERN: TileKind[] = ['photo', 'video', 'photo', 'video', 'photo', 'recording'];
    for (let i = 0; i < TILE_COUNT; i++) {
      const kind = KIND_PATTERN[i % KIND_PATTERN.length];
      let mat: THREE.MeshBasicMaterial;
      let geo: THREE.BufferGeometry;
      let src: string | null = null;
      if (kind === 'photo') {
        mat = photoMats.length ? photoMats[pIdx % photoMats.length] : photoFallbackMat!;
        if (photoUrls.length) src = photoUrls[pIdx % photoUrls.length];
        pIdx++;
        geo = photoGeo;
      } else if (kind === 'video') {
        mat = videoMats.length ? videoMats[vIdx % videoMats.length] : videoFallbackMat!;
        if (VIDEOS.length) src = VIDEOS[vIdx % VIDEOS.length];
        vIdx++;
        geo = videoGeo;
      } else {
        mat = recordingMat;
        geo = recordingGeo;
      }
      meta.push({ id: i, kind, src, mat, geo });
    }

    const visible = filtered ? meta.filter((m) => preservedRef.current.includes(m.id)) : meta;
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const n = Math.max(1, visible.length);
    const ringR = Math.min(3.7, Math.max(3.0, n / (2 * Math.PI) + 0.9));
    visible.forEach((m, idx) => {
      const tile = new THREE.Mesh(m.geo, m.mat);
      tile.userData.id = m.id;
      tile.userData.kind = m.kind;
      tile.userData.src = m.src;
      if (filtered) {
        const a = (idx / n) * Math.PI * 2;
        tile.position.set(Math.cos(a) * ringR, 0, Math.sin(a) * ringR);
        tile.lookAt(centreTarget);
      } else {
        const t = n <= 1 ? 0.5 : idx / (n - 1);
        const y = 1 - t * 2;
        const r = Math.sqrt(Math.max(0, 1 - y * y));
        const theta = goldenAngle * idx;
        tile.position.set(Math.cos(theta) * r * RADIUS, y * RADIUS * Y_SQUASH, Math.sin(theta) * r * RADIUS);
        tile.lookAt(centreTarget);
      }
      sphere.add(tile);
      tiles.push(tile);
    });

    ready = true;

    const gltfLoader = new GLTFLoader();
    gltfLoader.load(
      CENTER_MODEL,
      (gltf) => {
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const ctr = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const s = CENTER_SIZE / maxDim;
        model.scale.setScalar(s);
        model.position.set(-ctr.x * s, -ctr.y * s, -ctr.z * s);
        model.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (mesh.isMesh) {
            disposables.push(mesh.geometry);
            const m = mesh.material;
            (Array.isArray(m) ? m : [m]).forEach((mat) => mat && disposables.push(mat));
          }
        });
        center = new THREE.Group();
        center.add(model);
        scene.add(center);
      },
      undefined,
      (err) => console.error('Failed to load centre model', err),
    );

    let frame = 0;
    let last = performance.now();
    const clockStart = last;

    const animate = () => {
      frame = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      gridUniforms.uTime.value = (now - clockStart) / 1000;

      const h = hover.current;
      let hovering = false;
      if (ready && tiles.length) {
        raycaster.setFromCamera(pointer, camera);
        hovering = raycaster.intersectObjects(tiles, false).length > 0;
      }
      h.active = hovering;
      h.ease += ((hovering ? 1 : 0) - h.ease) * Math.min(1, dt * 6);
      if (labelRef.current) {
        const op = openRef.current ? 0 : h.ease;
        labelRef.current.style.opacity = op.toFixed(3);
        labelRef.current.style.transform = `translate(${h.x + 18}px, ${h.y + 18}px)`;
      }

      const d = drive.current;
      const wantCursor = d.dragging ? 'grabbing' : hovering && !openRef.current ? 'pointer' : 'grab';
      if (canvas.style.cursor !== wantCursor) canvas.style.cursor = wantCursor;

      d.velX *= Math.pow(SPIN_DAMPING, dt * 60);
      d.velY *= Math.pow(SPIN_DAMPING, dt * 60);
      d.velX = Math.max(-4, Math.min(4, d.velX));
      d.velY = Math.max(-4, Math.min(4, d.velY));
      if (!d.dragging && !openRef.current) {
        d.angleX += d.velX * dt;
        d.angleY += d.velY * dt;
        d.angleY += IDLE_SPIN * dt * (1 - h.ease);
      }
      d.angleX = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, d.angleX));

      if (ready) {
        sphere.rotation.x = d.angleX;
        sphere.rotation.y = d.angleY;
        if (center && !openRef.current) center.rotation.y += dt * 0.3;
      }

      renderer.render(scene, camera);
    };
    animate();

    const onWheel = (e: WheelEvent) => {
      drive.current.velY += e.deltaY * 0.004;
    };
    window.addEventListener('wheel', onWheel, { passive: true });

    const onPointerDown = (e: PointerEvent) => {
      const d = drive.current;
      d.dragging = true;
      d.pointerId = e.pointerId;
      d.lastX = e.clientX;
      d.lastY = e.clientY;
      d.lastT = e.timeStamp;
      d.moved = 0;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
      }
    };
    canvas.addEventListener('pointerdown', onPointerDown);

    const onPointerMove = (e: PointerEvent) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
      hover.current.x = e.clientX;
      hover.current.y = e.clientY;

      const d = drive.current;
      if (!d.dragging || e.pointerId !== d.pointerId) return;
      const dx = e.clientX - d.lastX;
      const dy = e.clientY - d.lastY;
      const dtMs = e.timeStamp - d.lastT;
      d.lastX = e.clientX;
      d.lastY = e.clientY;
      d.lastT = e.timeStamp;
      d.moved += Math.hypot(dx, dy);

      const deltaYaw = dx * DRAG_TO_ANGLE;
      const deltaPitch = -dy * DRAG_TO_ANGLE;
      d.angleY += deltaYaw;
      d.angleX = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, d.angleX + deltaPitch));
      if (dtMs > 0) {
        const s = dtMs / 1000;
        d.velX = Math.max(-4, Math.min(4, deltaPitch / s));
        d.velY = Math.max(-4, Math.min(4, deltaYaw / s));
      }
    };
    window.addEventListener('pointermove', onPointerMove);

    const onPointerUp = (e: PointerEvent) => {
      const d = drive.current;
      if (e.pointerId !== d.pointerId) return;
      d.dragging = false;
      d.pointerId = -1;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
      }
      if (d.moved < 6 && ready && !openRef.current && tiles.length) {
        pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
        pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(tiles, false);
        if (hits.length > 0) {
          const ud = hits[0].object.userData;
          setOpened({ id: (ud.id as number) ?? -1, kind: (ud.kind as TileKind) ?? 'photo', src: (ud.src as string | null) ?? null });
        }
      }
    };
    window.addEventListener('pointerup', onPointerUp);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpened(null);
    };
    window.addEventListener('keydown', onKey);

    const onResize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
      renderer.setSize(W, H);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      sizeGrid();
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      for (const d of disposables) d.dispose();
      renderer.dispose();
    };
  }, [photoUrl, filtered]);

  return (
    <div className="absolute inset-0 z-50 overflow-hidden" style={{ background: '#0c0c0c' }}>
      <canvas ref={canvasRef} className="block h-full w-full" />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(12,12,12,0) 55%, rgba(12,12,12,0.35) 85%, rgba(12,12,12,0.7) 100%)',
        }}
      />

      <div className="absolute left-1/2 top-[5%] z-20" style={{ transform: 'translateX(-50%)' }}>
        <LogoBlur text="ECHO" fontMin={28.8} fontVw={0.045} fontMax={57.6} blur={6} circleSize={0.7} />
      </div>

      <p
        className="pointer-events-none absolute left-1/2 bottom-[8%] z-20 select-none text-center"
        style={{
          transform: 'translateX(-50%)',
          fontFamily: 'var(--font-michroma), sans-serif',
          fontSize: 'clamp(0.9rem, 1.6vw, 1.25rem)',
          letterSpacing: '0.12em',
          color: 'rgba(255,255,255,0.6)',
        }}
      >
        {name ? `${name}'s echo` : 'Your echo'}
      </p>

      <button
        type="button"
        onClick={() => {
          if (filtered) {
            setFiltered(false);
          } else if (preserved.length > 0) {
            setOpened(null);
            setFiltered(true);
          }
        }}
        aria-label={filtered ? 'Show all memories' : 'Show preserved artifacts'}
        className="echo-cta"
        style={{
          position: 'absolute',
          right: 'clamp(1.25rem, 4vw, 2.5rem)',
          bottom: 'clamp(1.25rem, 4vh, 2.5rem)',
          zIndex: 20,
          height: '44px',
          padding: '0 26px',
          borderRadius: '22px',
          border: `1px solid ${filtered ? 'rgba(232,93,53,0.9)' : 'rgba(255,255,255,0.35)'}`,
          background: filtered
            ? 'linear-gradient(135deg, rgba(232,93,53,0.35), rgba(232,93,53,0.12)), rgba(16,17,22,0.5)'
            : 'linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0) 52%, rgba(255,255,255,0.12)), rgba(16,17,22,0.46)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)',
          color: '#ffffff',
          fontFamily: 'var(--font-michroma), sans-serif',
          fontSize: '0.8rem',
          letterSpacing: '0.02em',
          cursor: preserved.length > 0 || filtered ? 'pointer' : 'default',
          opacity: preserved.length > 0 || filtered ? 1 : 0.55,
        }}
      >
        {filtered ? 'Show all' : preserved.length > 0 ? `Artifacts · ${preserved.length}` : 'Artifacts'}
      </button>

      <div
        ref={labelRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-30 select-none"
        style={{
          opacity: 0,
          transform: 'translate(-200px, -200px)',
          padding: '8px 16px',
          borderRadius: '999px',
          background: 'rgba(19,19,19,0.7)',
          border: '1px solid rgba(255,255,255,0.18)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          fontFamily: 'var(--font-michroma), sans-serif',
          fontSize: '0.85rem',
          letterSpacing: '0.08em',
          color: '#ffffff',
          whiteSpace: 'nowrap',
          willChange: 'transform, opacity',
        }}
      >
        {name ? `${name}'s echo` : 'This memory'}
      </div>

      {opened !== null && (
        <div
          className="echo-lightbox fixed inset-0 flex items-center justify-center px-6"
          style={{
            zIndex: 70,
            background: 'rgba(8,8,8,0.82)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
          }}
          role="dialog"
          aria-modal="true"
          aria-label={`${name ? `${name}'s` : 'Your'} ${opened.kind}`}
          onClick={() => setOpened(null)}
        >
          <div
            className="echo-lightbox-img relative flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: opened.kind === 'video' ? 'min(94vw, 760px)' : 'min(88vw, 440px)',
              background: '#171717',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '32px',
              padding: '30px 28px 26px',
              boxShadow: '0 40px 110px rgba(0,0,0,0.6)',
            }}
          >
            <div className="relative flex w-full items-center justify-center" style={{ minHeight: '236px' }}>
              {opened.kind === 'photo' && (
                <div
                  style={{
                    width: '100%',
                    aspectRatio: '4 / 5',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    background: '#2a2a2a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {opened.src ? (
                    <img src={opened.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={1.5}>
                      <rect x="3" y="4" width="18" height="16" rx="2" />
                      <circle cx="8.5" cy="9" r="1.6" />
                      <path d="M21 16l-5-5L5 20" />
                    </svg>
                  )}
                </div>
              )}

              {opened.kind === 'video' && (
                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: '16 / 10',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    background: '#000',
                  }}
                >
                  {opened.src ? (
                    <>
                      <video
                        ref={videoRef}
                        key={opened.src}
                        src={opened.src}
                        playsInline
                        onClick={toggleVideo}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onLoadedMetadata={(e) => setVDur(e.currentTarget.duration || 0)}
                        onTimeUpdate={(e) => setVCur(e.currentTarget.currentTime)}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer', display: 'block' }}
                      />
                      <div
                        aria-hidden
                        style={{
                          position: 'absolute',
                          inset: 0,
                          pointerEvents: 'none',
                          background: 'linear-gradient(to bottom, rgba(0,0,0,0) 58%, rgba(0,0,0,0.55))',
                        }}
                      />
                      <button
                        type="button"
                        onClick={toggleVideo}
                        aria-label={isPlaying ? 'Pause' : 'Play'}
                        className="grid place-items-center"
                        style={{
                          position: 'absolute',
                          left: '50%',
                          top: '50%',
                          transform: 'translate(-50%, -50%)',
                          width: '88px',
                          height: '88px',
                          borderRadius: '50%',
                          background: 'rgba(50,50,50,0.55)',
                          border: '1px solid rgba(255,255,255,0.45)',
                          backdropFilter: 'blur(4px)',
                          WebkitBackdropFilter: 'blur(4px)',
                          color: '#ffffff',
                          cursor: 'pointer',
                          opacity: isPlaying ? 0 : 1,
                          transition: 'opacity 0.25s ease',
                        }}
                      >
                        <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </button>
                      <div
                        style={{
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          bottom: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '0 18px',
                        }}
                      >
                        <span style={{ ...CARD_TIME, color: 'rgba(255,255,255,0.9)' }}>{fmtTime(vCur)}</span>
                        <div
                          onClick={seekVideo}
                          style={{ flex: 1, height: '14px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                        >
                          <div style={{ position: 'relative', width: '100%', height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.3)' }}>
                            <div
                              style={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                height: '100%',
                                borderRadius: '2px',
                                background: '#ffffff',
                                width: `${vDur ? (vCur / vDur) * 100 : 0}%`,
                              }}
                            />
                            <div
                              style={{
                                position: 'absolute',
                                top: '50%',
                                left: `${vDur ? (vCur / vDur) * 100 : 0}%`,
                                transform: 'translate(-50%, -50%)',
                                width: '11px',
                                height: '11px',
                                borderRadius: '50%',
                                background: '#ffffff',
                              }}
                            />
                          </div>
                        </div>
                        <span style={{ ...CARD_TIME, color: 'rgba(255,255,255,0.9)' }}>{fmtTime(vDur)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="grid h-full w-full place-items-center">
                      <svg width="62" height="62" viewBox="0 0 24 24" fill="rgba(255,255,255,0.55)">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  )}
                </div>
              )}

              {opened.kind === 'recording' && (
                <div className="flex w-full flex-col items-center" style={{ gap: '26px' }}>
                  <svg width="116" height="116" viewBox="0 0 116 116" style={{ opacity: 0.55 }}>
                    <circle cx="58" cy="58" r="58" fill="rgba(255,255,255,0.07)" />
                    {[20, 34, 52, 34, 66, 84, 66, 34, 52, 34, 20].map((hh, i) => (
                      <rect
                        key={i}
                        x={3 + i * 10}
                        y={58 - hh / 2}
                        width={5}
                        height={hh}
                        rx={2.5}
                        fill="rgba(255,255,255,0.55)"
                      />
                    ))}
                  </svg>
                  <div className="flex w-full items-center" style={{ gap: '12px' }}>
                    <span style={CARD_TIME}>0:02</span>
                    <div className="flex flex-1 items-center justify-center" style={{ gap: '3px', height: '40px' }}>
                      {Array.from({ length: 18 }).map((_, i) => {
                        const hh = 6 + Math.round(16 * Math.abs(Math.sin(i * 1.1)));
                        return (
                          <span
                            key={i}
                            style={{
                              width: '3px',
                              height: `${hh}px`,
                              borderRadius: '2px',
                              background: i < 7 ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.28)',
                            }}
                          />
                        );
                      })}
                    </div>
                    <span style={CARD_TIME}>0:05</span>
                  </div>
                </div>
              )}
            </div>

            <p
              className="select-none text-center"
              style={{
                marginTop: '26px',
                fontFamily: 'var(--font-michroma), sans-serif',
                fontSize: 'clamp(1.05rem, 2.3vw, 1.6rem)',
                color: '#ffffff',
              }}
            >
              {name ? `${name}'s ${opened.kind}` : `Your ${opened.kind}`}
            </p>

            {(() => {
              const isPreserved = preserved.includes(opened.id);
              return (
                <button
                  type="button"
                  onClick={() =>
                    setPreserved((prev) =>
                      isPreserved ? prev.filter((id) => id !== opened.id) : [...prev, opened.id],
                    )
                  }
                  className="echo-cta"
                  style={{
                    marginTop: '18px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 18px',
                    borderRadius: '999px',
                    border: `1px solid ${isPreserved ? 'rgba(232,93,53,0.9)' : 'rgba(255,255,255,0.3)'}`,
                    background: isPreserved ? 'rgba(232,93,53,0.18)' : 'rgba(255,255,255,0.05)',
                    color: '#ffffff',
                    fontFamily: 'var(--font-michroma), sans-serif',
                    fontSize: '0.76rem',
                    letterSpacing: '0.04em',
                    cursor: 'pointer',
                  }}
                >
                  {isPreserved ? 'Preserved ✓' : 'Preserve to Artifacts'}
                </button>
              );
            })()}

            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpened(null)}
              className="echo-cta grid place-items-center"
              style={{
                position: 'absolute',
                top: '-16px',
                right: '-16px',
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                border: '1px solid rgba(255,255,255,0.4)',
                background: 'rgba(19,19,19,0.85)',
                color: '#ffffff',
                fontSize: '1.1rem',
                lineHeight: 1,
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
