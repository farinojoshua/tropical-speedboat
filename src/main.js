import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

import { sampleOcean } from './waves.js';
import { createSkySystem, TIME_PRESETS } from './sky.js';
import { createOcean } from './ocean.js';
import { createSpeedboat } from './boat.js';
import { createWorld } from './world.js';
import { BoatAudio } from './audio.js';
import { createHud } from './hud.js';

// --- Renderer & Scene Setup ---
const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance'
});
const pixelRatio = Math.min(window.devicePixelRatio, 2);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(TIME_PRESETS.noon.fogColor.clone(), 430, 2200);

const camera = new THREE.PerspectiveCamera(56, window.innerWidth / window.innerHeight, 0.35, 3450);

// --- Build Core Systems ---
const sky = createSkySystem(scene);
const world = createWorld(scene);
const ocean = createOcean(scene, world.islands);
const boat = createSpeedboat(scene);
const audio = new BoatAudio();
const hud = createHud();

// --- Procedural Tropical Sky & Ocean PMREM Environment Reflections ---
const pmrem = new THREE.PMREMGenerator(renderer);
let currentEnvRT = null;

function rebuildEnvironmentMap(presetKey) {
  const p = TIME_PRESETS[presetKey] || TIME_PRESETS.noon;
  const envScene = new THREE.Scene();
  const envGeo = new THREE.SphereGeometry(40, 32, 20);
  const envMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      uZenith: { value: p.zenith },
      uHorizon: { value: p.horizon },
      uWater: { value: p.waterShallow },
      uSunDir: { value: p.sunDir },
      uSunColor: { value: p.sunColor }
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      uniform vec3 uWater;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        vec3 col = d.y >= 0.0
          ? mix(uHorizon, uZenith, pow(max(d.y, 0.0001), 0.55))
          : mix(uHorizon, uWater, pow(max(-d.y, 0.0001), 0.45));
        float s = pow(max(dot(d, normalize(uSunDir)), 0.0001), 42.0);
        col += uSunColor * s * 2.8;
        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
  envScene.add(new THREE.Mesh(envGeo, envMat));
  const nextRT = pmrem.fromScene(envScene, 0.04);
  if (currentEnvRT) currentEnvRT.dispose();
  currentEnvRT = nextRT;
  scene.environment = nextRT.texture;
  envGeo.dispose();
  envMat.dispose();
}
rebuildEnvironmentMap('noon');

// --- Cinematic HDR 4x MSAA Post-Processing Pipeline (GTA VI Sun Bloom + Lens Glare + Spray Mist) ---
const CinematicGradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSunScreen: { value: new THREE.Vector2(0.72, 0.88) },
    uSunVisible: { value: 1.0 },
    uSunColor: { value: TIME_PRESETS.noon.sunColor.clone() },
    uSprayWet: { value: 0.0 },
    uTime: { value: 0.0 },
    uAspect: { value: window.innerWidth / window.innerHeight }
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uSunScreen;
    uniform float uSunVisible;
    uniform vec3 uSunColor;
    uniform float uSprayWet;
    uniform float uTime;
    uniform float uAspect;
    varying vec2 vUv;

    void main() {
      vec2 uv = vUv;

      // Subtle liquid water-spray refraction on camera lens after big wave landings
      if (uSprayWet > 0.01) {
        vec2 dropGrid = uv * vec2(18.0 * uAspect, 18.0) + vec2(0.0, uTime * 1.8);
        vec2 cell = fract(dropGrid) - 0.5;
        float r = length(cell);
        float drop = smoothstep(0.24, 0.06, r) * uSprayWet;
        uv += cell * drop * 0.018;
      }

      vec3 col = texture2D(tDiffuse, uv).rgb;

      // Warm cinematic solar lens flare & subtle anamorphic sun halo (matches GTA VI upper-right glare!)
      if (uSunVisible > 0.01) {
        vec2 diff = (uv - uSunScreen) * vec2(uAspect, 1.0);
        float d = length(diff);
        float sunGlow = exp(-d * 3.8) * 0.16 + exp(-d * 14.0) * 0.22;
        // Soft anamorphic streak
        float streak = exp(-abs(uv.y - uSunScreen.y) * 44.0) * exp(-abs(uv.x - uSunScreen.x) * 3.2) * 0.14;
        // Subtle opposite lens ghost ring
        vec2 ghostPos = vec2(0.5) - (uSunScreen - vec2(0.5)) * 0.55;
        float gd = length((uv - ghostPos) * vec2(uAspect, 1.0));
        float ghost = smoothstep(0.11, 0.075, gd) * smoothstep(0.03, 0.07, gd) * 0.045;
        col += uSunColor * (sunGlow + streak + ghost) * uSunVisible;
      }

      // Delicate cinematic vignette & crisp sunny micro-contrast
      vec2 vCentered = uv - 0.5;
      float vig = 1.0 - dot(vCentered, vCentered) * 0.24;
      col *= clamp(vig, 0.78, 1.0);

      gl_FragColor = vec4(col, 1.0);
    }
  `
};

let composer = null;
let bloomPass = null;
let gradePass = null;

try {
  const isWebGL2 = renderer.capabilities.isWebGL2;
  const rtParams = {
    type: isWebGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType,
    samples: isWebGL2 ? 4 : 0
  };
  const renderTarget = new THREE.WebGLRenderTarget(
    Math.floor(window.innerWidth * pixelRatio),
    Math.floor(window.innerHeight * pixelRatio),
    rtParams
  );

  composer = new EffectComposer(renderer, renderTarget);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(window.innerWidth, window.innerHeight);

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // Subtle calibrated HDR bloom (makes sun, water glitter & pink waypoint glow smoothly!)
  bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.34, // strength
    0.58, // radius
    0.94  // threshold (only bright HDR sun/glitter/beacon bloom)
  );
  composer.addPass(bloomPass);

  gradePass = new ShaderPass(CinematicGradeShader);
  composer.addPass(gradePass);

  const outputPass = new OutputPass();
  composer.addPass(outputPass);
} catch (err) {
  console.warn('Post-processing fallback to direct renderer:', err);
  composer = null;
}

// --- Game & Boat State ---
const CAMERA_MODES = ['Chase', 'Close', 'Helm', 'Orbit'];
const TIME_KEYS = ['noon', 'sunset', 'dusk'];

const state = {
  started: false,
  mode: 'run',
  cameraIdx: 0,
  timeIdx: 0,

  // Boat kinematics
  pos: new THREE.Vector3(0, 0.25, 0),
  vel: new THREE.Vector3(0, 0, 0),
  vy: 0,
  yaw: 0,
  yawVel: 0,
  pitch: 0,
  pitchVel: 0,
  roll: 0,
  rollVel: 0,
  steerAngle: 0,
  speed: 0,
  boost: 1.0,
  airborne: false,

  // Camera spring & immersion state
  orbitYawOffset: 0,
  orbitPitchOffset: 0,
  isDragging: false,
  lastPointerX: 0,
  lastPointerY: 0,
  camRoll: 0,
  camShake: 0,
  sprayWet: 0,
  boostLag: 0,

  // Island Run progression
  cpIndex: 0,
  runTime: 0,
  bestTime: Number(localStorage.getItem('leonida_best_time') || 0)
};

// Critically-damped spring camera states (zero jitter, weighty GTA VI feel!)
const camPosSmooth = new THREE.Vector3(0, 3.2, 10.6);
const camPosVel = new THREE.Vector3(0, 0, 0);
const camLookSmooth = new THREE.Vector3(0, 1.5, -20);
const camLookVel = new THREE.Vector3(0, 0, 0);

// Critically-damped spring helper (exact analytical exponential decay, frame-rate independent!)
function smoothDampVec3(current, target, velocity, smoothTime, dt) {
  const omega = 2.0 / Math.max(0.0001, smoothTime);
  const x = omega * dt;
  const exp = 1.0 / (1.0 + x + 0.48 * x * x + 0.235 * x * x * x);

  const cx = current.x - target.x;
  const cy = current.y - target.y;
  const cz = current.z - target.z;

  const tx = (velocity.x + omega * cx) * dt;
  const ty = (velocity.y + omega * cy) * dt;
  const tz = (velocity.z + omega * cz) * dt;

  velocity.x = (velocity.x - omega * tx) * exp;
  velocity.y = (velocity.y - omega * ty) * exp;
  velocity.z = (velocity.z - omega * tz) * exp;

  current.x = target.x + (cx + tx) * exp;
  current.y = target.y + (cy + ty) * exp;
  current.z = target.z + (cz + tz) * exp;
}

function smoothDampScalar(current, target, velRef, smoothTime, dt) {
  const omega = 2.0 / Math.max(0.0001, smoothTime);
  const x = omega * dt;
  const exp = 1.0 / (1.0 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (velRef.v + omega * change) * dt;
  velRef.v = (velRef.v - omega * temp) * exp;
  return target + (change + temp) * exp;
}

// --- Input State ---
const keys = {
  up: false,
  down: false,
  left: false,
  right: false,
  boost: false,
  drift: false
};

function bindKey(code, pressed) {
  switch (code) {
    case 'KeyW':
    case 'ArrowUp':
      keys.up = pressed; break;
    case 'KeyS':
    case 'ArrowDown':
      keys.down = pressed; break;
    case 'KeyA':
    case 'ArrowLeft':
      keys.left = pressed; break;
    case 'KeyD':
    case 'ArrowRight':
      keys.right = pressed; break;
    case 'Space':
      keys.boost = pressed; break;
    case 'ShiftLeft':
    case 'ShiftRight':
      keys.drift = pressed; break;
    default: break;
  }
}

window.addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
    e.preventDefault();
  }
  bindKey(e.code, true);

  if (!e.repeat) {
    if (e.code === 'KeyC') cycleCamera();
    if (e.code === 'KeyT') cycleTime();
    if (e.code === 'KeyM') toggleMode();
    if (e.code === 'KeyV') toggleAudio();
    if (e.code === 'KeyR' && state.started) resetBoat();
  }
});

window.addEventListener('keyup', (e) => {
  bindKey(e.code, false);
});

canvas.addEventListener('pointerdown', (e) => {
  state.isDragging = true;
  state.lastPointerX = e.clientX;
  state.lastPointerY = e.clientY;
});

window.addEventListener('pointermove', (e) => {
  if (!state.isDragging) return;
  const dx = e.clientX - state.lastPointerX;
  const dy = e.clientY - state.lastPointerY;
  state.lastPointerX = e.clientX;
  state.lastPointerY = e.clientY;
  state.orbitYawOffset -= dx * 0.0055;
  state.orbitPitchOffset = THREE.MathUtils.clamp(state.orbitPitchOffset + dy * 0.004, -0.22, 0.55);
});

window.addEventListener('pointerup', () => {
  state.isDragging = false;
});

document.querySelectorAll('.touch-btn').forEach((btn) => {
  const k = btn.dataset.key;
  const down = (e) => { e.preventDefault(); keys[k] = true; };
  const up = (e) => { e.preventDefault(); keys[k] = false; };
  btn.addEventListener('pointerdown', down);
  btn.addEventListener('pointerup', up);
  btn.addEventListener('pointerleave', up);
  btn.addEventListener('pointercancel', up);
});

// --- UI Buttons ---
const startOverlay = document.getElementById('start-overlay');
const finishOverlay = document.getElementById('finish-overlay');
const btnMode = document.getElementById('btn-mode');
const btnCamera = document.getElementById('btn-camera');
const btnTime = document.getElementById('btn-time');
const btnAudio = document.getElementById('btn-audio');

function startGame(mode) {
  audio.init();
  state.started = true;
  state.mode = mode;
  startOverlay.classList.add('hidden');
  finishOverlay.classList.add('hidden');
  resetRun(mode === 'run');
  btnMode.textContent = mode === 'run' ? 'Mode: Run' : 'Mode: Free';
  hud.showToast(mode === 'run' ? 'HEAD TO THE MAGENTA WAYPOINT!' : 'FREE ROAM — EXPLORE LEONIDA KEYS');
}

function resetBoat() {
  state.pos.set(0, 0.25, 0);
  state.vel.set(0, 0, 0);
  state.vy = 0;
  state.yaw = 0;
  state.yawVel = 0;
  state.pitch = 0;
  state.pitchVel = 0;
  state.roll = 0;
  state.rollVel = 0;
  state.speed = 0;
  state.boost = 1.0;
}

function resetRun(resetPos = true) {
  if (resetPos) resetBoat();
  state.cpIndex = 0;
  state.runTime = 0;
  world.setActiveCheckpoint(world.checkpoints[0], state.mode === 'run');
}

function cycleCamera() {
  state.cameraIdx = (state.cameraIdx + 1) % CAMERA_MODES.length;
  btnCamera.textContent = `Cam: ${CAMERA_MODES[state.cameraIdx]}`;
  state.orbitYawOffset = 0;
  state.orbitPitchOffset = 0;
}

function cycleTime() {
  state.timeIdx = (state.timeIdx + 1) % TIME_KEYS.length;
  const key = TIME_KEYS[state.timeIdx];
  const p = sky.applyPreset(key);
  ocean.applyPreset(key);
  rebuildEnvironmentMap(key);
  if (gradePass) {
    gradePass.uniforms.uSunColor.value.copy(p.sunColor);
  }
  btnTime.textContent = p.label;
}

function toggleMode() {
  state.mode = state.mode === 'run' ? 'free' : 'run';
  btnMode.textContent = state.mode === 'run' ? 'Mode: Run' : 'Mode: Free';
  if (state.mode === 'run') {
    resetRun(false);
    hud.showToast('ISLAND RUN STARTED — HIT ALL 12 WAYPOINTS');
  } else {
    world.setActiveCheckpoint(null, false);
    hud.showToast('FREE ROAM MODE');
  }
}

function toggleAudio() {
  audio.init();
  audio.setEnabled(!audio.enabled);
  btnAudio.textContent = audio.enabled ? 'SFX: On' : 'SFX: Off';
}

document.getElementById('btn-start-run').addEventListener('click', () => startGame('run'));
document.getElementById('btn-start-free').addEventListener('click', () => startGame('free'));
document.getElementById('btn-replay').addEventListener('click', () => startGame('run'));
document.getElementById('btn-continue-free').addEventListener('click', () => {
  finishOverlay.classList.add('hidden');
  state.mode = 'free';
  btnMode.textContent = 'Mode: Free';
  world.setActiveCheckpoint(null, false);
});
btnMode.addEventListener('click', toggleMode);
btnCamera.addEventListener('click', cycleCamera);
btnTime.addEventListener('click', cycleTime);
btnAudio.addEventListener('click', toggleAudio);

world.setActiveCheckpoint(world.checkpoints[0], true);

window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  if (composer) {
    composer.setSize(w, h);
  }
  if (bloomPass) {
    bloomPass.resolution.set(w, h);
  }
  if (gradePass) {
    gradePass.uniforms.uAspect.value = w / h;
  }
});

// --- Sub-Stepped Silky Boat Physics & Buoyancy ---
const forwardVec = new THREE.Vector3();
const rightVec = new THREE.Vector3();
const pitchVelRef = { v: 0 };
const rollVelRef = { v: 0 };

function stepPhysics(dt, time) {
  let throttle = 0;
  let steerInput = 0;
  let boosting = false;

  if (state.started) {
    if (keys.up) throttle += 1;
    if (keys.down) throttle -= 0.65;
    if (keys.left) steerInput += 1;
    if (keys.right) steerInput -= 1;

    if (keys.boost && state.boost > 0.04 && throttle >= 0) {
      boosting = true;
      throttle = Math.max(throttle, 1.0);
      state.boost = Math.max(0, state.boost - dt * 0.28);
    } else {
      state.boost = Math.min(1, state.boost + dt * 0.14);
    }
  } else {
    // Scenic GTA-style cruising demo on title screen so the wake & waves look alive!
    throttle = 0.44;
  }

  state.steerAngle = THREE.MathUtils.lerp(state.steerAngle, steerInput, 1 - Math.exp(-dt * 9.5));

  forwardVec.set(-Math.sin(state.yaw), 0, -Math.cos(state.yaw));
  rightVec.set(Math.cos(state.yaw), 0, -Math.sin(state.yaw));

  const forwardSpeed = state.vel.dot(forwardVec);
  const lateralSpeed = state.vel.dot(rightVec);

  const turnPower = keys.drift ? 2.45 : 1.85;
  const speedTurnFactor = THREE.MathUtils.clamp(Math.abs(forwardSpeed) / 7.2, 0.28, 1.15);
  const reverseSign = forwardSpeed < -1.5 ? -1 : 1;
  const targetYawVel = state.steerAngle * turnPower * speedTurnFactor * reverseSign;
  state.yawVel = THREE.MathUtils.lerp(state.yawVel, targetYawVel, 1 - Math.exp(-dt * (state.airborne ? 1.6 : 6.4)));
  state.yaw += state.yawVel * dt;

  forwardVec.set(-Math.sin(state.yaw), 0, -Math.cos(state.yaw));
  rightVec.set(Math.cos(state.yaw), 0, -Math.sin(state.yaw));

  const thrustAccel = boosting ? 43.0 : 26.0;
  const propGrip = state.airborne ? 0.12 : 1.0;
  let newFwd = forwardSpeed + throttle * thrustAccel * propGrip * dt;

  const fwdDrag = state.airborne ? 0.14 : (boosting ? 0.48 : 0.72);
  newFwd *= Math.exp(-fwdDrag * dt);
  newFwd = THREE.MathUtils.clamp(newFwd, -13, 52);

  const latGrip = state.airborne ? 0.3 : (keys.drift ? 2.0 : 4.3);
  const newLat = lateralSpeed * Math.exp(-latGrip * dt);

  state.vel.copy(forwardVec).multiplyScalar(newFwd).addScaledVector(rightVec, newLat);
  state.speed = newFwd;

  state.pos.x += state.vel.x * dt;
  state.pos.z += state.vel.z * dt;

  const distOrigin = Math.hypot(state.pos.x, state.pos.z);
  if (distOrigin > 880) {
    const push = (distOrigin - 880) * 0.5;
    state.pos.x -= (state.pos.x / distOrigin) * push;
    state.pos.z -= (state.pos.z / distOrigin) * push;
  }

  for (const isl of world.islands) {
    const dx = state.pos.x - isl.x;
    const dz = state.pos.z - isl.z;
    const dist = Math.hypot(dx, dz);
    const minDist = isl.radius + 3.2;
    if (dist < minDist && dist > 0.001) {
      const nx = dx / dist;
      const nz = dz / dist;
      state.pos.x = isl.x + nx * minDist;
      state.pos.z = isl.z + nz * minDist;
      const vn = state.vel.x * nx + state.vel.z * nz;
      if (vn < 0) {
        state.vel.x -= nx * vn * 1.45;
        state.vel.z -= nz * vn * 1.45;
        state.vel.multiplyScalar(0.68);
      }
    }
  }

  for (const v of world.npcVessels) {
    const dx = state.pos.x - v.mesh.position.x;
    const dz = state.pos.z - v.mesh.position.z;
    const dist = Math.hypot(dx, dz);
    const minDist = 8.0;
    if (dist < minDist && dist > 0.001) {
      const nx = dx / dist;
      const nz = dz / dist;
      state.pos.x = v.mesh.position.x + nx * minDist;
      state.pos.z = v.mesh.position.z + nz * minDist;
      state.vel.x += nx * 5.0;
      state.vel.z += nz * 5.0;
    }
  }

  // Multi-point Gerstner wave sampling
  const bowSample = sampleOcean(state.pos.x + forwardVec.x * 3.4, state.pos.z + forwardVec.z * 3.4, time);
  const sternSample = sampleOcean(state.pos.x - forwardVec.x * 3.2, state.pos.z - forwardVec.z * 3.2, time);
  const portSample = sampleOcean(state.pos.x - rightVec.x * 1.3, state.pos.z - rightVec.z * 1.3, time);
  const stbdSample = sampleOcean(state.pos.x + rightVec.x * 1.3, state.pos.z + rightVec.z * 1.3, time);

  let surfaceY = (bowSample.height + sternSample.height + portSample.height + stbdSample.height) * 0.25;
  let onRamp = false;

  for (const r of world.ramps) {
    const dx = state.pos.x - r.x;
    const dz = state.pos.z - r.z;
    const cosR = Math.cos(-r.rotY);
    const sinR = Math.sin(-r.rotY);
    const lx = dx * cosR - dz * sinR;
    const lz = dx * sinR + dz * cosR;
    if (Math.abs(lx) < r.halfWidth && Math.abs(lz) < r.halfLength) {
      const tRamp = THREE.MathUtils.clamp((r.halfLength - lz) / (r.halfLength * 2), 0, 1);
      const rampY = r.mesh.position.y + tRamp * 3.15;
      if (rampY > surfaceY) {
        surfaceY = rampY;
        onRamp = true;
        if (tRamp > 0.78 && newFwd > 14 && state.vy < 8.5) {
          state.vy = Math.max(state.vy, Math.min(11.8, newFwd * 0.35));
          hud.showToast('AIRTIME!', 1100);
        }
      }
    }
  }

  const planingLift = THREE.MathUtils.clamp(Math.abs(newFwd) / 30, 0, 1) * 0.25;
  const targetY = surfaceY + 0.14 + planingLift;
  const depth = targetY - state.pos.y;
  let splashBurst = 0;

  if (depth > 0 || onRamp) {
    if (state.airborne && state.vy < -3.0) {
      splashBurst = THREE.MathUtils.clamp(Math.abs(state.vy) / 7.2, 0.35, 1.6);
      audio.playSplash(splashBurst);
      state.camShake = Math.min(1.0, state.camShake + splashBurst * 0.55);
      state.sprayWet = Math.min(1.0, state.sprayWet + splashBurst * 0.75);
    }
    state.airborne = false;
    const springK = onRamp ? 42 : 26;
    const damp = onRamp ? 10.2 : 7.4;
    state.vy += (depth * springK - state.vy * damp) * dt;
    if (!onRamp && newFwd > 25 && bowSample.height - sternSample.height > 0.34 && state.pos.y > surfaceY - 0.1) {
      state.vy += (newFwd - 23) * 0.22 * dt;
    }
  } else {
    state.vy -= 15.2 * dt;
    if (state.pos.y - targetY > 0.65) {
      state.airborne = true;
    }
  }

  state.pos.y += state.vy * dt;
  if (onRamp && state.pos.y < targetY) {
    state.pos.y = targetY;
  }

  // Critically-damped smooth hull pitch & roll (liquid-smooth marine inertia!)
  const wavePitch = Math.atan2(bowSample.height - sternSample.height, 6.6);
  const trimPitch = THREE.MathUtils.clamp(newFwd / 38, -0.05, 0.14) + (boosting ? 0.055 : 0);
  const airPitch = state.airborne ? THREE.MathUtils.clamp(state.vy * 0.03, -0.22, 0.26) : 0;
  const targetPitch = onRamp ? 0.24 : (wavePitch * 0.76 + trimPitch + airPitch);

  const waveRoll = Math.atan2(portSample.height - stbdSample.height, 2.6);
  const bankRoll = state.steerAngle * THREE.MathUtils.clamp(Math.abs(newFwd) / 25, 0, 1) * (keys.drift ? 0.36 : 0.25);
  const targetRoll = waveRoll * 0.62 + bankRoll;

  state.pitch = smoothDampScalar(state.pitch, targetPitch, pitchVelRef, 0.16, dt);
  state.roll = smoothDampScalar(state.roll, targetRoll, rollVelRef, 0.15, dt);

  return { throttle, boosting, splashBurst, surfaceY };
}

function updateBoat(dt, time) {
  // 2 physics sub-steps per frame for ultra-consistent smoothness at any refresh rate
  const subDt = dt * 0.5;
  let lastRes = stepPhysics(subDt, time - subDt);
  const res2 = stepPhysics(subDt, time);
  lastRes = {
    throttle: res2.throttle,
    boosting: res2.boosting,
    splashBurst: Math.max(lastRes.splashBurst, res2.splashBurst),
    surfaceY: res2.surfaceY
  };

  boat.root.position.copy(state.pos);
  boat.root.rotation.order = 'YXZ';
  boat.root.rotation.set(state.pitch, state.yaw, state.roll);

  boat.updateVisuals(dt, {
    steerAngle: state.steerAngle,
    speed: state.speed,
    throttle: lastRes.throttle,
    boosting: lastRes.boosting,
    splashBurst: lastRes.splashBurst,
    waterY: lastRes.surfaceY,
    time,
    airborne: state.airborne
  });

  audio.update(
    THREE.MathUtils.clamp(Math.abs(state.speed) / 36, 0, 1.3),
    Math.abs(lastRes.throttle),
    lastRes.boosting,
    state.airborne
  );

  // Subtle camera boost surge lag & spray evaporation
  state.boostLag = THREE.MathUtils.lerp(state.boostLag, lastRes.boosting ? 1.55 : 0, 1 - Math.exp(-dt * 4.5));
  state.camShake = Math.max(0, state.camShake - dt * 2.4);
  state.sprayWet = Math.max(0, state.sprayWet - dt * 0.45);

  if (state.started && state.mode === 'run') {
    state.runTime += dt;
    const cp = world.checkpoints[state.cpIndex];
    if (cp) {
      const d = Math.hypot(state.pos.x - cp.x, state.pos.z - cp.z);
      if (d < 16.5) {
        state.cpIndex++;
        state.boost = Math.min(1, state.boost + 0.35);
        if (state.cpIndex >= world.checkpoints.length) {
          audio.playCheckpoint(true);
          world.setActiveCheckpoint(null, false);
          finishRun();
        } else {
          audio.playCheckpoint(false);
          world.setActiveCheckpoint(world.checkpoints[state.cpIndex], true);
          hud.showToast(`WAYPOINT ${state.cpIndex} / ${world.checkpoints.length} • +BOOST`, 1400);
        }
      }
    }
  }
}

function finishRun() {
  const finishTimeEl = document.getElementById('finish-time');
  const finishBestEl = document.getElementById('finish-best');
  finishTimeEl.textContent = hud.formatTime(state.runTime);

  if (!state.bestTime || state.runTime < state.bestTime) {
    state.bestTime = state.runTime;
    localStorage.setItem('leonida_best_time', String(state.bestTime));
    finishBestEl.textContent = 'New Best Time!';
  } else {
    finishBestEl.textContent = `Best Time: ${hud.formatTime(state.bestTime)}`;
  }
  finishOverlay.classList.remove('hidden');
}

// --- Critically-Damped GTA VI Spring Camera ---
const desiredCamPos = new THREE.Vector3();
const desiredLookAt = new THREE.Vector3();
const sunProjVec = new THREE.Vector3();

function updateCamera(dt, time) {
  const modeName = CAMERA_MODES[state.cameraIdx];

  if (!state.isDragging && Math.abs(state.speed) > 3.5 && modeName !== 'Orbit') {
    state.orbitYawOffset = THREE.MathUtils.lerp(state.orbitYawOffset, 0, 1 - Math.exp(-dt * 1.6));
    state.orbitPitchOffset = THREE.MathUtils.lerp(state.orbitPitchOffset, 0, 1 - Math.exp(-dt * 1.6));
  }

  const speedFactor = THREE.MathUtils.clamp(Math.abs(state.speed) / 38, 0, 1);

  if (modeName === 'Helm') {
    const helmLocal = new THREE.Vector3(-0.14, 2.02, 0.24).applyQuaternion(boat.root.quaternion);
    const lookLocal = new THREE.Vector3(-0.14, 1.82, -26).applyQuaternion(boat.root.quaternion);
    camera.position.copy(state.pos).add(helmLocal);
    camera.lookAt(state.pos.clone().add(lookLocal));
    camera.fov = THREE.MathUtils.lerp(camera.fov, 64 + speedFactor * 8, 1 - Math.exp(-dt * 5));
    camera.updateProjectionMatrix();
    return;
  }

  // Tight cinematic GTA VI chase framing over the twin black outboards
  let backDist = 9.75 + speedFactor * 1.45 + state.boostLag;
  let height = 2.98 + speedFactor * 0.28;
  let lookAhead = 24.0;

  if (modeName === 'Close') {
    backDist = 7.8 + speedFactor * 1.0 + state.boostLag * 0.7;
    height = 2.38;
    lookAhead = 19.0;
  } else if (modeName === 'Orbit') {
    backDist = 17.5;
    height = 5.8;
    lookAhead = 4.0;
  }

  const totalYaw = state.yaw + state.orbitYawOffset;
  const pitchLift = state.orbitPitchOffset * 7.5;

  // Subtle lateral swing-out into carve turns (gives buttery GTA VI weight!)
  const turnSwing = -state.steerAngle * speedFactor * 0.75;

  desiredCamPos.set(
    state.pos.x + Math.sin(totalYaw) * backDist + Math.cos(totalYaw) * turnSwing,
    Math.max(1.15, state.pos.y + height + pitchLift),
    state.pos.z + Math.cos(totalYaw) * backDist - Math.sin(totalYaw) * turnSwing
  );

  desiredLookAt.set(
    state.pos.x - Math.sin(totalYaw) * lookAhead,
    state.pos.y + 1.48 - state.orbitPitchOffset * 2.8,
    state.pos.z - Math.cos(totalYaw) * lookAhead
  );

  smoothDampVec3(camPosSmooth, desiredCamPos, camPosVel, 0.16, dt);
  smoothDampVec3(camLookSmooth, desiredLookAt, camLookVel, 0.11, dt);

  camera.position.copy(camPosSmooth);

  // Cushioned impact micro-shake on big wave jump landings
  if (state.camShake > 0.005) {
    const amp = state.camShake * 0.22;
    camera.position.x += Math.sin(time * 48.0) * amp;
    camera.position.y += Math.cos(time * 57.0) * amp * 0.85;
  }

  camera.lookAt(camLookSmooth);

  // Ultra-subtle cinematic horizon banking when carving hard turns
  const targetCamRoll = -state.steerAngle * speedFactor * 0.032;
  state.camRoll = THREE.MathUtils.lerp(state.camRoll, targetCamRoll, 1 - Math.exp(-dt * 5.0));
  camera.rotateZ(state.camRoll);

  // Smooth speed/boost FOV kick
  const targetFov = 55 + speedFactor * 9.5 + (keys.boost && state.boost > 0.05 && state.started ? 5.5 : 0);
  camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 1 - Math.exp(-dt * 4.8));
  camera.updateProjectionMatrix();

  // Project sun direction onto screen space for cinematic lens glare pass
  if (gradePass) {
    const p = TIME_PRESETS[TIME_KEYS[state.timeIdx]] || TIME_PRESETS.noon;
    sunProjVec.copy(camera.position).addScaledVector(p.sunDir, 1000).project(camera);
    const inFront = sunProjVec.z < 1.0;
    const sx = sunProjVec.x * 0.5 + 0.5;
    const sy = sunProjVec.y * 0.5 + 0.5;
    const camDotSun = camera.getWorldDirection(desiredLookAt).dot(p.sunDir);
    gradePass.uniforms.uSunScreen.value.set(sx, sy);
    gradePass.uniforms.uSunVisible.value = inFront ? THREE.MathUtils.clamp((camDotSun - 0.15) * 1.4, 0, 1) : 0;
    gradePass.uniforms.uSprayWet.value = state.sprayWet;
    gradePass.uniforms.uTime.value = time;
  }
}

// --- Main Animation Loop ---
let prevTime = performance.now() * 0.001;

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now() * 0.001;
  const dt = Math.min(0.05, Math.max(0.001, now - prevTime));
  prevTime = now;

  updateBoat(dt, now);
  updateCamera(dt, now);

  const sternWorld = boat.getSternWorldPosition();
  ocean.update(now, dt, state.pos, sternWorld, state.speed);
  sky.update(now, state.pos, TIME_KEYS[state.timeIdx]);
  world.update(now, dt);

  const activeWp = state.mode === 'run' ? world.checkpoints[state.cpIndex] || null : null;
  hud.update({
    boatPos: state.pos,
    boatYaw: state.yaw,
    speedKnots: state.speed * 1.94384,
    boost: state.boost,
    mode: state.mode,
    cpIndex: state.cpIndex,
    cpTotal: world.checkpoints.length,
    runTime: state.runTime,
    activeWaypoint: activeWp,
    islands: world.islands,
    npcVessels: world.npcVessels,
    camera
  });

  if (composer) {
    composer.render();
  } else {
    renderer.render(scene, camera);
  }
}

animate();
