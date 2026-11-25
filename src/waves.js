import * as THREE from 'three';

/**
 * Shared wave spectrum used identically by both the GPU ocean shader
 * and CPU boat/buoy buoyancy physics so objects ride the exact visual waves.
 *
 * Each wave: [dirX, dirZ, amplitude, wavelength, speed, steepness]
 */
export const WAVES = [
  { dir: [0.86, 0.51], amp: 0.42, len: 38.0, speed: 1.45, steep: 0.34 },
  { dir: [-0.42, 0.91], amp: 0.28, len: 23.0, speed: 1.75, steep: 0.30 },
  { dir: [0.35, -0.94], amp: 0.17, len: 13.5, speed: 2.10, steep: 0.26 },
  { dir: [-0.93, -0.37], amp: 0.10, len: 7.8, speed: 2.55, steep: 0.20 }
];

// Pack wave constants into Vector4 arrays for GPU uniforms
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
 * Evaluate water surface height (y) and approximate normal at world (x, z) and time t.
 * Matches the Gerstner displacement in the ocean vertex shader.
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

    y += w.amp * s;
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
