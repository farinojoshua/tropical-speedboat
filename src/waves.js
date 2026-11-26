import * as THREE from 'three';

/**
 * 6-component directional Gerstner ocean wave spectrum shared between
 * GPU vertex displacement (ocean.js) and CPU multi-point buoyancy physics (main.js).
 * True trochoidal swells produce wider calm troughs and livelier sunlit crests.
 */
export const WAVES = [
  { dir: [0.85, 0.53], amp: 0.36, len: 46.0, speed: 1.32, steep: 0.36 },
  { dir: [-0.46, 0.89], amp: 0.25, len: 29.0, speed: 1.62, steep: 0.32 },
  { dir: [0.34, -0.94], amp: 0.16, len: 18.0, speed: 1.95, steep: 0.28 },
  { dir: [-0.92, -0.39], amp: 0.10, len: 11.5, speed: 2.35, steep: 0.22 },
  { dir: [0.68, -0.73], amp: 0.06, len: 7.4, speed: 2.75, steep: 0.16 },
  { dir: [-0.18, 0.98], amp: 0.04, len: 4.9, speed: 3.15, steep: 0.12 }
];

export function getWaveUniforms() {
  const waveA = []; // (dirX, dirZ, amp, k)
  const waveB = []; // (speed, steep, 0, 0)
  for (const w of WAVES) {
    const k = (Math.PI * 2) / w.len;
    waveA.push(new THREE.Vector4(w.dir[0], w.dir[1], w.amp, k));
    waveB.push(new THREE.Vector4(w.speed, w.steep, 0, 0));
  }
  return { waveA, waveB };
}

/**
 * Evaluate Gerstner water height and surface normal at world (x, z) and time t.
 */
export function sampleOcean(x, z, t) {
  let y = 0;
  let dYdX = 0;
  let dYdZ = 0;

  for (let i = 0; i < WAVES.length; i++) {
    const w = WAVES[i];
    const k = (Math.PI * 2) / w.len;
    const phase = k * (w.dir[0] * x + w.dir[1] * z) + t * w.speed;
    const s = Math.sin(phase);
    const c = Math.cos(phase);

    // Subtle trochoidal peak sharpening matches GPU Gerstner displacement
    y += w.amp * (s + 0.14 * w.steep * (s * s - 0.5));
    const slope = w.amp * k * c;
    dYdX += slope * w.dir[0];
    dYdZ += slope * w.dir[1];
  }

  const nx = -dYdX;
  const ny = 1.0;
  const nz = -dYdZ;
  const invLen = 1.0 / Math.hypot(nx, ny, nz);

  return {
    height: y,
    normal: { x: nx * invLen, y: ny * invLen, z: nz * invLen }
  };
}
