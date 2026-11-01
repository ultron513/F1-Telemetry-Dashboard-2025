"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export interface Track3DData {
  x: number[];
  y: number[];
  z: number[];
  distance: number[];
  length: number;
  elevation_range: number;
}

export interface Car3D {
  code: string;
  color: string;
  /** Fraction of the lap, 0–1. */
  frac: number;
  highlight?: boolean;
  dim?: boolean;
}

const WIDTH = 24; // metres, drawn a little wider than reality so it reads at distance

function cssVar(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function label(text: string, color: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 56;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(10,12,16,0.85)";
  ctx.beginPath();
  ctx.roundRect(4, 6, 120, 44, 10);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fillRect(12, 16, 6, 24);
  ctx.fillStyle = "#fff";
  ctx.font = "700 28px 'Titillium Web', system-ui, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 26, 29);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  sprite.scale.set(110, 48, 1);
  sprite.renderOrder = 10;
  return sprite;
}

/**
 * The circuit as a 3D ribbon with real elevation (exaggerated so it reads),
 * cars placed by lap fraction along the racing line. Drag to orbit, scroll
 * to zoom.
 */
export function Track3D({
  track,
  cars,
  height = 480,
  exaggeration = 4,
  ariaLabel,
}: {
  track: Track3DData;
  cars: Car3D[];
  height?: number;
  exaggeration?: number;
  ariaLabel: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const carsRef = useRef<Car3D[]>(cars);
  useEffect(() => {
    carsRef.current = cars;
  }, [cars]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const n = track.x.length;
    const cx = (Math.min(...track.x) + Math.max(...track.x)) / 2;
    const cy = (Math.min(...track.y) + Math.max(...track.y)) / 2;
    const zMin = Math.min(...track.z);
    const pts = track.x.map((x, i) => new THREE.Vector3(x - cx, (track.z[i] - zMin) * exaggeration, -(track.y[i] - cy)));
    const span = Math.max(Math.max(...track.x) - Math.min(...track.x), Math.max(...track.y) - Math.min(...track.y));

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.setSize(el.clientWidth, height);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, el.clientWidth / height, 1, span * 10);
    // Frame the whole circuit: distance from the tighter of the two fields of view.
    const fitCamera = (aspect: number) => {
      const v = THREE.MathUtils.degToRad(camera.fov) / 2;
      const h = Math.atan(Math.tan(v) * aspect);
      const dist = (span / 2 / Math.tan(Math.min(v, h))) * 1.08;
      camera.position.copy(new THREE.Vector3(0, 0.78, 0.62).normalize().multiplyScalar(dist));
      camera.far = dist * 6;
      camera.updateProjectionMatrix();
    };
    fitCamera(el.clientWidth / height);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.target.set(0, 0, 0);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(span, span * 1.5, span * 0.5);
    scene.add(sun);

    const team = new THREE.Color(cssVar("--team-primary", "#e10600"));
    const low = new THREE.Color(cssVar("--surface-3", "#2b313c")).lerp(new THREE.Color(0xffffff), 0.12);
    const high = low.clone().lerp(team, 0.85);
    const zRange = Math.max(1, track.elevation_range * exaggeration);

    // Ribbon + side skirt down to the ground plane.
    const positions: number[] = [];
    const colors: number[] = [];
    const skirt: number[] = [];
    const left: THREE.Vector3[] = [];
    const right: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(n - 1, i + 1)];
      const t = new THREE.Vector3().subVectors(b, a).setY(0).normalize();
      const nrm = new THREE.Vector3(-t.z, 0, t.x).multiplyScalar(WIDTH / 2);
      left.push(pts[i].clone().add(nrm));
      right.push(pts[i].clone().sub(nrm));
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const quad = [left[i], right[i], left[j], right[i], right[j], left[j]];
      for (const v of quad) {
        positions.push(v.x, v.y, v.z);
        const c = low.clone().lerp(high, v.y / zRange);
        colors.push(c.r, c.g, c.b);
      }
      for (const [p, q] of [
        [left[i], left[j]],
        [right[i], right[j]],
      ]) {
        skirt.push(p.x, p.y, p.z, p.x, -2, p.z, q.x, q.y, q.z, p.x, -2, p.z, q.x, -2, q.z, q.x, q.y, q.z);
      }
    }
    const ribbon = new THREE.BufferGeometry();
    ribbon.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    ribbon.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    ribbon.computeVertexNormals();
    scene.add(new THREE.Mesh(ribbon, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.75 })));
    const skirtGeo = new THREE.BufferGeometry();
    skirtGeo.setAttribute("position", new THREE.Float32BufferAttribute(skirt, 3));
    scene.add(new THREE.Mesh(skirtGeo, new THREE.MeshBasicMaterial({ color: low, transparent: true, opacity: 0.35, side: THREE.DoubleSide })));

    // Racing line + start/finish.
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts.map((p) => p.clone().setY(p.y + 0.6))),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }),
    );
    scene.add(line);
    const start = new THREE.Mesh(new THREE.BoxGeometry(WIDTH + 4, 1.2, 3), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    start.position.copy(pts[0]);
    start.lookAt(pts[1]);
    scene.add(start);

    const grid = new THREE.GridHelper(span * 1.6, 32, low.getHex(), low.getHex());
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.35;
    grid.position.y = -2;
    scene.add(grid);

    // Cars: one sphere each, labels for highlighted cars.
    const carGroup = new THREE.Group();
    scene.add(carGroup);
    const meshes = new Map<string, { mesh: THREE.Mesh; tag: THREE.Sprite | null }>();
    const sphere = new THREE.SphereGeometry(1, 20, 14);

    const at = (frac: number) => {
      const d = (((frac % 1) + 1) % 1) * track.length;
      let lo = 0;
      let hi = n - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (track.distance[mid] < d) lo = mid + 1;
        else hi = mid;
      }
      const i1 = Math.max(1, lo);
      const i0 = i1 - 1;
      const span01 = track.distance[i1] - track.distance[i0] || 1;
      const w = Math.min(1, Math.max(0, (d - track.distance[i0]) / span01));
      return pts[i0].clone().lerp(pts[i1], w);
    };

    const sync = () => {
      const seen = new Set<string>();
      for (const c of carsRef.current) {
        seen.add(c.code);
        let entry = meshes.get(c.code);
        if (!entry) {
          const mesh = new THREE.Mesh(sphere, new THREE.MeshStandardMaterial({ color: c.color, emissive: c.color, emissiveIntensity: 0.35 }));
          carGroup.add(mesh);
          entry = { mesh, tag: null };
          meshes.set(c.code, entry);
        }
        const p = at(c.frac);
        const r = c.highlight ? 20 : 13;
        entry.mesh.scale.setScalar(r);
        entry.mesh.position.set(p.x, p.y + r * 0.9, p.z);
        (entry.mesh.material as THREE.MeshStandardMaterial).opacity = c.dim ? 0.35 : 1;
        (entry.mesh.material as THREE.MeshStandardMaterial).transparent = !!c.dim;
        if (c.highlight && !entry.tag) {
          entry.tag = label(c.code, c.color);
          carGroup.add(entry.tag);
        }
        if (!c.highlight && entry.tag) {
          carGroup.remove(entry.tag);
          entry.tag.material.map?.dispose();
          entry.tag.material.dispose();
          entry.tag = null;
        }
        if (entry.tag) entry.tag.position.set(p.x, p.y + r * 2 + 38, p.z);
      }
      for (const [code, entry] of meshes) {
        if (!seen.has(code)) {
          entry.mesh.visible = false;
          if (entry.tag) entry.tag.visible = false;
        } else {
          entry.mesh.visible = true;
          if (entry.tag) entry.tag.visible = true;
        }
      }
    };

    renderer.setAnimationLoop(() => {
      sync();
      controls.update();
      renderer.render(scene, camera);
    });

    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      renderer.setSize(w, height);
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      renderer.setAnimationLoop(null);
      controls.dispose();
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose?.();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose?.();
      });
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, [track, height, exaggeration]);

  return <div ref={host} role="img" aria-label={ariaLabel} className="w-full cursor-grab active:cursor-grabbing" style={{ height }} />;
}
