import * as THREE from 'three';
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
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(TIME_PRESETS.noon.fogColor.clone(), 420, 2150);

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.4, 3400);

// --- Build Systems ---
const sky = createSkySystem(scene);
const world = createWorld(scene);
const ocean = createOcean(scene, world.islands);
const boat = createSpeedboat(scene);
const audio = new BoatAudio();
const hud = createHud();

// --- Game & Boat State ---
const CAMERA_MODES = ['Chase', 'Close', 'Helm', 'Orbit'];
const TIME_KEYS = ['noon', 'sunset', 'dusk'];

const state = {
  started: false,
  mode: 'run', // 'run' | 'free'
  cameraIdx: 0,
  timeIdx: 0,

  // Boat kinematics
  pos: new THREE.Vector3(0, 0.25, 0),
  vel: new THREE.Vector3(0, 0, 0),
  vy: 0,
  yaw: 0, // facing -Z initially (straight into open bay with sun upper-right!)
  yawVel: 0,
  pitch: 0,
  roll: 0,
  steerAngle: 0,
  speed: 0,
  boost: 1.0,
  airborne: false,

  // Camera orbit look
  orbitYawOffset: 0,
  orbitPitchOffset: 0,
  isDragging: false,
  lastPointerX: 0,
  lastPointerY: 0,

  // Island Run progression
  cpIndex: 0,
  runTime: 0,
  bestTime: Number(localStorage.getItem('leonida_best_time') || 0)
};

// Smooth chase camera state
const camPosSmooth = new THREE.Vector3(0, 4.4, 12.8);
const camLookSmooth = new THREE.Vector3(0, 1.4, -18);

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

// Mouse drag to smoothly look around the boat
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

// Touch controls
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
  state.roll = 0;
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

// Show first checkpoint immediately in background preview (just like the screenshot!)
world.setActiveCheckpoint(world.checkpoints[0], true);

// --- Resize Handling ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Boat Physics & Buoyancy Step ---
const forwardVec = new THREE.Vector3();
const rightVec = new THREE.Vector3();

function updateBoatPhysics(dt, time) {
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
    // Gentle scenic idle cruise on the title screen so the wake & waves look alive!
    throttle = 0.42;
  }

  state.steerAngle = THREE.MathUtils.lerp(state.steerAngle, steerInput, Math.min(1, dt * 8.5));

  forwardVec.set(-Math.sin(state.yaw), 0, -Math.cos(state.yaw));
  rightVec.set(Math.cos(state.yaw), 0, -Math.sin(state.yaw));

  const forwardSpeed = state.vel.dot(forwardVec);
  const lateralSpeed = state.vel.dot(rightVec);

  // Turning torque scales with water flow over the lower units
  const turnPower = keys.drift ? 2.45 : 1.85;
  const speedTurnFactor = THREE.MathUtils.clamp(Math.abs(forwardSpeed) / 7.5, 0.28, 1.15);
  const reverseSign = forwardSpeed < -1.5 ? -1 : 1;
  const targetYawVel = state.steerAngle * turnPower * speedTurnFactor * reverseSign;
  state.yawVel = THREE.MathUtils.lerp(state.yawVel, targetYawVel, Math.min(1, dt * (state.airborne ? 1.5 : 5.8)));
  state.yaw += state.yawVel * dt;

  // Recompute basis after yaw step
  forwardVec.set(-Math.sin(state.yaw), 0, -Math.cos(state.yaw));
  rightVec.set(Math.cos(state.yaw), 0, -Math.sin(state.yaw));

  // Propulsion thrust (only applies strongly when props are in water!)
  const thrustAccel = boosting ? 42.0 : 25.5;
  const propGrip = state.airborne ? 0.12 : 1.0;
  let newFwd = forwardSpeed + throttle * thrustAccel * propGrip * dt;

  // Hydrodynamic quadratic + linear drag (caps around ~35 m/s cruising, ~50 m/s boost)
  const fwdDrag = state.airborne ? 0.14 : (boosting ? 0.48 : 0.72);
  newFwd *= Math.max(0, 1 - fwdDrag * dt);
  newFwd = THREE.MathUtils.clamp(newFwd, -13, 52);

  // Lateral keel grip (carving vs drifting)
  const latGrip = state.airborne ? 0.3 : (keys.drift ? 2.1 : 4.2);
  const newLat = lateralSpeed * Math.max(0, 1 - latGrip * dt);

  state.vel.copy(forwardVec).multiplyScalar(newFwd).addScaledVector(rightVec, newLat);
  state.speed = newFwd;

  // Move horizontally
  state.pos.x += state.vel.x * dt;
  state.pos.z += state.vel.z * dt;

  // Keep boat inside generous tropical bay boundary (~920m)
  const distOrigin = Math.hypot(state.pos.x, state.pos.z);
  if (distOrigin > 880) {
    const push = (distOrigin - 880) * 0.5;
    state.pos.x -= (state.pos.x / distOrigin) * push;
    state.pos.z -= (state.pos.z / distOrigin) * push;
  }

  // Soft collision against island beaches
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

  // Soft collision against NPC boats
  for (const v of world.npcVessels) {
    const dx = state.pos.x - v.mesh.position.x;
    const dz = state.pos.z - v.mesh.position.z;
    const dist = Math.hypot(dx, dz);
    const minDist = 7.8;
    if (dist < minDist && dist > 0.001) {
      const nx = dx / dist;
      const nz = dz / dist;
      state.pos.x = v.mesh.position.x + nx * minDist;
      state.pos.z = v.mesh.position.z + nz * minDist;
      state.vel.x += nx * 5.0;
      state.vel.z += nz * 5.0;
    }
  }

  // --- Multi-point Ocean Wave Sampling & Stunt Ramp Detection ---
  const bowSample = sampleOcean(state.pos.x + forwardVec.x * 3.4, state.pos.z + forwardVec.z * 3.4, time);
  const sternSample = sampleOcean(state.pos.x - forwardVec.x * 3.2, state.pos.z - forwardVec.z * 3.2, time);
  const portSample = sampleOcean(state.pos.x - rightVec.x * 1.3, state.pos.z - rightVec.z * 1.3, time);
  const stbdSample = sampleOcean(state.pos.x + rightVec.x * 1.3, state.pos.z + rightVec.z * 1.3, time);

  let surfaceY = (bowSample.height + sternSample.height + portSample.height + stbdSample.height) * 0.25;
  let onRamp = false;

  // Check wooden stunt jump ramps
  for (const r of world.ramps) {
    const dx = state.pos.x - r.x;
    const dz = state.pos.z - r.z;
    const cosR = Math.cos(-r.rotY);
    const sinR = Math.sin(-r.rotY);
    const lx = dx * cosR - dz * sinR;
    const lz = dx * sinR + dz * cosR;
    if (Math.abs(lx) < r.halfWidth && Math.abs(lz) < r.halfLength) {
      // Ramp rises from z = +halfLength (y=0) to z = -halfLength (y=3.1)
      const tRamp = THREE.MathUtils.clamp((r.halfLength - lz) / (r.halfLength * 2), 0, 1);
      const rampY = r.mesh.position.y + tRamp * 3.15;
      if (rampY > surfaceY) {
        surfaceY = rampY;
        onRamp = true;
        // Launch impulse near ramp lip!
        if (tRamp > 0.78 && newFwd > 14 && state.vy < 8.5) {
          state.vy = Math.max(state.vy, Math.min(11.5, newFwd * 0.34));
          hud.showToast('AIRTIME!', 1100);
        }
      }
    }
  }

  // Vertical buoyancy spring + gravity
  const planingLift = THREE.MathUtils.clamp(Math.abs(newFwd) / 30, 0, 1) * 0.24;
  const targetY = surfaceY + 0.14 + planingLift;
  const depth = targetY - state.pos.y;
  let splashBurst = 0;

  if (depth > 0 || onRamp) {
    // In water (or riding ramp): strong buoyancy spring + damping
    if (state.airborne && state.vy < -3.2) {
      splashBurst = THREE.MathUtils.clamp(Math.abs(state.vy) / 7.5, 0.35, 1.5);
      audio.playSplash(splashBurst);
    }
    state.airborne = false;
    const springK = onRamp ? 42 : 24;
    const damp = onRamp ? 9.5 : 6.4;
    state.vy += (depth * springK - state.vy * damp) * dt;
    // High-speed wave crest launch
    if (!onRamp && newFwd > 24 && bowSample.height - sternSample.height > 0.35 && state.pos.y > surfaceY - 0.1) {
      state.vy += (newFwd - 22) * 0.22 * dt;
    }
  } else {
    // Airborne!
    state.vy -= 15.2 * dt;
    if (state.pos.y - targetY > 0.65) {
      state.airborne = true;
    }
  }

  state.pos.y += state.vy * dt;
  if (onRamp && state.pos.y < targetY) {
    state.pos.y = targetY;
  }

  // Dynamic hull pitch (waves + powerboat bow-up trim at speed + ramp angle)
  const wavePitch = Math.atan2(bowSample.height - sternSample.height, 6.6);
  const trimPitch = THREE.MathUtils.clamp(newFwd / 38, -0.05, 0.14) + (boosting ? 0.055 : 0);
  const airPitch = state.airborne ? THREE.MathUtils.clamp(state.vy * 0.032, -0.22, 0.28) : 0;
  const targetPitch = onRamp ? 0.24 : (wavePitch * 0.78 + trimPitch + airPitch);

  // Dynamic hull roll (waves + carving inward bank into turns)
  const waveRoll = Math.atan2(portSample.height - stbdSample.height, 2.6);
  const bankRoll = state.steerAngle * THREE.MathUtils.clamp(Math.abs(newFwd) / 26, 0, 1) * (keys.drift ? 0.36 : 0.24);
  const targetRoll = waveRoll * 0.65 + bankRoll;

  state.pitch = THREE.MathUtils.lerp(state.pitch, targetPitch, Math.min(1, dt * 6.5));
  state.roll = THREE.MathUtils.lerp(state.roll, targetRoll, Math.min(1, dt * 6.5));

  // Apply transform to 3D boat mesh
  boat.root.position.copy(state.pos);
  boat.root.rotation.order = 'YXZ';
  boat.root.rotation.set(state.pitch, state.yaw, state.roll);

  // Update outboard steering, propellers, driver lean & spray particles
  boat.updateVisuals(dt, {
    steerAngle: state.steerAngle,
    speed: newFwd,
    throttle,
    boosting,
    splashBurst,
    waterY: surfaceY
  });

  // Update procedural audio
  audio.update(
    THREE.MathUtils.clamp(Math.abs(newFwd) / 36, 0, 1.3),
    Math.abs(throttle),
    boosting,
    state.airborne
  );

  // --- Checkpoints & Island Run Timer ---
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

// --- Camera Controller ---
const desiredCamPos = new THREE.Vector3();
const desiredLookAt = new THREE.Vector3();

function updateCamera(dt) {
  const modeName = CAMERA_MODES[state.cameraIdx];

  // Gently recenter mouse orbit while driving
  if (!state.isDragging && Math.abs(state.speed) > 3.5 && modeName !== 'Orbit') {
    state.orbitYawOffset = THREE.MathUtils.lerp(state.orbitYawOffset, 0, Math.min(1, dt * 1.4));
    state.orbitPitchOffset = THREE.MathUtils.lerp(state.orbitPitchOffset, 0, Math.min(1, dt * 1.4));
  }

  const speedFactor = THREE.MathUtils.clamp(Math.abs(state.speed) / 38, 0, 1);

  if (modeName === 'Helm') {
    // First-person behind center console windshield
    const helmLocal = new THREE.Vector3(-0.14, 2.02, 0.24).applyQuaternion(boat.root.quaternion);
    const lookLocal = new THREE.Vector3(-0.14, 1.82, -26).applyQuaternion(boat.root.quaternion);
    camera.position.copy(state.pos).add(helmLocal);
    camera.lookAt(state.pos.clone().add(lookLocal));
    camera.fov = THREE.MathUtils.lerp(camera.fov, 64 + speedFactor * 8, Math.min(1, dt * 5));
    camera.updateProjectionMatrix();
    return;
  }

  // Chase / Close / Orbit configurations
  let backDist = 11.4 + speedFactor * 1.8;
  let height = 3.55 + speedFactor * 0.35;
  let lookAhead = 22.0;

  if (modeName === 'Close') {
    backDist = 8.4 + speedFactor * 1.1;
    height = 2.55;
    lookAhead = 18.0;
  } else if (modeName === 'Orbit') {
    backDist = 18.5;
    height = 6.2;
    lookAhead = 4.0;
  }

  const totalYaw = state.yaw + state.orbitYawOffset;
  const pitchLift = state.orbitPitchOffset * 8.0;

  desiredCamPos.set(
    state.pos.x + Math.sin(totalYaw) * backDist,
    Math.max(1.2, state.pos.y + height + pitchLift),
    state.pos.z + Math.cos(totalYaw) * backDist
  );

  desiredLookAt.set(
    state.pos.x - Math.sin(totalYaw) * lookAhead,
    state.pos.y + 1.55 - state.orbitPitchOffset * 3.0,
    state.pos.z - Math.cos(totalYaw) * lookAhead
  );

  const smoothPos = 1 - Math.exp(-dt * 7.2);
  const smoothLook = 1 - Math.exp(-dt * 9.5);
  camPosSmooth.lerp(desiredCamPos, smoothPos);
  camLookSmooth.lerp(desiredLookAt, smoothLook);

  camera.position.copy(camPosSmooth);
  camera.lookAt(camLookSmooth);

  // Dynamic FOV kick on speed & nitro boost
  const targetFov = 56 + speedFactor * 10 + (keys.boost && state.boost > 0.05 && state.started ? 6 : 0);
  camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, Math.min(1, dt * 5));
  camera.updateProjectionMatrix();
}

// --- Main Animation Loop ---
let prevTime = performance.now() * 0.001;

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now() * 0.001;
  const dt = Math.min(0.05, Math.max(0.001, now - prevTime));
  prevTime = now;

  updateBoatPhysics(dt, now);
  updateCamera(dt);

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

  renderer.render(scene, camera);
}

animate();
