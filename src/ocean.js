import * as THREE from 'three';
import { getWaveUniforms } from './waves.js';
import { TIME_PRESETS } from './sky.js';

const MAX_WAKE_POINTS = 44;
const MAX_ISLANDS = 18;

const OCEAN_VERT = /* glsl */ `
  uniform float uTime;
  uniform vec4 uWaveA[4];
  uniform vec4 uWaveB[4];
  uniform vec2 uCenter;

  varying vec3 vWorldPos;
  varying vec3 vWaveNormal;
  varying float vWaveHeight;

  void main() {
    // High-density smooth mesh around the boat that expands gradually to the horizon
    vec2 local = position.xz;
    float dist = length(local);
    float stretch = 1.0 + pow(max(dist / 220.0, 0.0001), 2.35) * 3.8;
    vec2 worldXZ = uCenter + local * stretch;

    float y = 0.0;
    float dYdX = 0.0;
    float dYdZ = 0.0;

    float waveFade = 1.0 - smoothstep(420.0, 1550.0, length(worldXZ - uCenter));

    for (int i = 0; i < 4; i++) {
      vec2 dir = uWaveA[i].xy;
      float amp = uWaveA[i].z * waveFade;
      float k = uWaveA[i].w;
      float speed = uWaveB[i].x;

      float phase = k * dot(dir, worldXZ) + uTime * speed;
      float s = sin(phase);
      float c = cos(phase);

      y += amp * s;
      float slope = amp * k * c;
      dYdX += slope * dir.x;
      dYdZ += slope * dir.y;
    }

    vec3 worldPos = vec3(worldXZ.x, y, worldXZ.y);
    vWorldPos = worldPos;
    vWaveHeight = y;
    vWaveNormal = normalize(vec3(-dYdX, 1.0, -dYdZ));

    gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
  }
`;

// Uses true analytical multi-directional wave normals + isotropic 2D Simplex noise
// so the water surface, sun glitter, and wake foam are silky-smooth with ZERO square artifacts!
const OCEAN_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uSkyHorizon;
  uniform vec3 uSkyZenith;
  uniform vec3 uWaterDeep;
  uniform vec3 uWaterShallow;
  uniform vec3 uWaterSss;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;

  uniform vec4 uWake[${MAX_WAKE_POINTS}];
  uniform vec4 uIslands[${MAX_ISLANDS}];
  uniform int uIslandCount;

  varying vec3 vWorldPos;
  varying vec3 vWaveNormal;
  varying float vWaveHeight;

  // Isotropic 2D Simplex noise (zero grid/box artifacts)
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(
      0.211324865405187,
      0.366025403784439,
      -0.577350269189626,
      0.024390243902439
    );
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g) * 0.5 + 0.5;
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.52;
    mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
    for (int i = 0; i < 4; i++) {
      v += a * snoise(p);
      p = rot * p * 2.06 + vec2(7.3, -4.1);
      a *= 0.48;
    }
    return v;
  }

  // Exact analytical multi-octave capillary & swell ripples (C-infinity smooth!)
  vec3 computeAnalyticalRippleNormal(vec2 p, float distToCam) {
    float detailFade = 1.0 - smoothstep(140.0, 1050.0, distToCam);
    vec2 grad = vec2(0.0);

    // 8 irrational-angle harmonic wavelets with exact analytical derivatives
    float freq = 0.42;
    float amp = 0.095;
    float speed = 1.35;
    mat2 rot = mat2(0.766, 0.643, -0.643, 0.766); // ~40 deg rotation per octave
    vec2 dir = vec2(0.83, 0.55);

    for (int i = 0; i < 8; i++) {
      // Slight phase warping creates natural choppy wave crests instead of uniform stripes
      float phase = dot(p, dir) * freq + uTime * speed + sin(dot(p, vec2(-dir.y, dir.x)) * freq * 0.45 + uTime * 0.6) * 0.85;
      float waveDeriv = cos(phase) * exp(sin(phase) * 0.35 - 0.35);
      grad += dir * (waveDeriv * amp * freq);

      dir = rot * dir;
      freq *= 1.38;
      amp *= 0.64;
      speed *= 1.14;
    }

    float strength = mix(0.24, 1.0, detailFade);
    return normalize(vec3(-grad.x * strength, 1.0, -grad.y * strength));
  }

  void main() {
    vec3 viewVec = cameraPosition - vWorldPos;
    float dist = length(viewVec);
    vec3 V = viewVec / max(dist, 0.0001);
    vec3 L = normalize(uSunDir);

    vec3 rippleN = computeAnalyticalRippleNormal(vWorldPos.xz, dist);
    vec3 N = normalize(vec3(
      vWaveNormal.x + rippleN.x * 0.72,
      vWaveNormal.y,
      vWaveNormal.z + rippleN.z * 0.72
    ));

    // Island proximity -> glowing shallow Caribbean turquoise & organic lapping surf
    float shallowFactor = 0.0;
    float shoreFoam = 0.0;
    for (int i = 0; i < ${MAX_ISLANDS}; i++) {
      if (i >= uIslandCount) break;
      vec4 isl = uIslands[i];
      float d = length(vWorldPos.xz - isl.xy) - isl.z;
      shallowFactor = max(shallowFactor, 1.0 - smoothstep(0.0, 52.0, d));
      if (d < 12.0) {
        float nShore = snoise(vWorldPos.xz * 0.18 + uTime * 0.2);
        float waveLap = sin(d * 0.8 - uTime * 2.2 + nShore * 4.2);
        float shoreBand = (1.0 - smoothstep(-2.0, 6.2, d)) * smoothstep(-5.0, 0.6, d);
        shoreFoam = max(shoreFoam, shoreBand * smoothstep(0.08, 0.82, waveLap * 0.5 + 0.5));
      }
    }

    // Schlick Fresnel
    float NdotV = clamp(dot(N, V), 0.001, 0.999);
    float fresnel = 0.03 + 0.97 * pow(1.0 - NdotV, 4.3);

    // Rich tropical turquoise water color
    float heightFactor = smoothstep(-0.55, 0.72, vWaveHeight);
    vec3 baseWater = mix(
      uWaterDeep,
      uWaterShallow,
      clamp(0.46 + heightFactor * 0.44 + shallowFactor * 0.55, 0.0, 1.0)
    );

    // Subsurface turquoise sunlight transmission through wave crests
    float sss = pow(max(dot(V, -L + N * 0.45), 0.0001), 3.0) * (0.45 + heightFactor * 0.82);
    float crestGlow = smoothstep(0.16, 0.82, vWaveHeight) * 0.34;
    baseWater += uWaterSss * (sss * 0.56 + crestGlow + shallowFactor * 0.18);

    // Reflected sky gradient
    vec3 R = reflect(-V, N);
    float reflY = clamp(R.y, 0.0001, 1.0);
    vec3 skyRefl = mix(uSkyHorizon, uSkyZenith, pow(reflY, 0.52));

    vec3 col = mix(baseWater, skyRefl, clamp(fresnel * 0.82, 0.07, 0.86));

    // Silky sparkling sun glitter path (exact micro-wave reflection!)
    vec3 H = normalize(L + V);
    float NdotH = max(dot(N, H), 0.0001);
    float specSharp = pow(NdotH, 360.0) * 4.2;
    float specMed = pow(NdotH, 58.0) * 0.68;
    float specWide = pow(NdotH, 14.0) * 0.14;
    float sparkle = pow(NdotH, 130.0) * smoothstep(0.55, 0.9, snoise(vWorldPos.xz * 1.9 + vec2(uTime * 1.1, -uTime * 0.8))) * 2.5;
    col += uSunColor * (specSharp + specMed + specWide + sparkle);

    // Dynamic twin-V speedboat wake & frothy white prop wash using smooth Simplex fBm
    float wakeFoam = 0.0;
    float wakeTurbulence = 0.0;
    if (dist < 260.0) {
      float foamA = fbm(vWorldPos.xz * 0.42 + vec2(uTime * 0.35, -uTime * 0.28));
      float foamB = snoise(vWorldPos.xz * 1.55 - vec2(uTime * 0.72, uTime * 0.45));

      for (int i = 0; i < ${MAX_WAKE_POINTS - 1}; i++) {
        vec4 pA = uWake[i];
        vec4 pB = uWake[i + 1];
        if (pA.w < 0.02 || pB.w < 0.02) continue;

        vec2 seg = pB.xy - pA.xy;
        float segLenSq = dot(seg, seg);
        if (segLenSq < 0.0001) continue;

        float t = clamp(dot(vWorldPos.xz - pA.xy, seg) / segLenSq, 0.0, 1.0);
        vec2 closest = pA.xy + seg * t;
        float d = length(vWorldPos.xz - closest);

        float age = mix(pA.z, pB.z, t);
        float intensity = mix(pA.w, pB.w, t);
        float life = clamp(1.0 - age / 5.0, 0.0, 1.0);
        if (life <= 0.0) continue;

        // Expanding V-wake Kelvin arms with feathery organic foam breakup
        float armOffset = 1.65 + age * 4.45;
        float armWidth = 0.95 + age * 1.25;
        float armDist = abs(d - armOffset);
        float armMask = (1.0 - smoothstep(0.0, armWidth, armDist)) * life * intensity;

        // Churning central twin-prop wash ribbon
        float centerWidth = 1.55 + age * 0.78;
        float centerMask = (1.0 - smoothstep(0.0, centerWidth, d)) * pow(max(life, 0.0001), 1.3) * intensity;

        // Aerated turquoise glow inside wake V
        float innerMask = (1.0 - smoothstep(0.0, armOffset, d)) * life * intensity * 0.30;

        wakeFoam = max(wakeFoam, armMask * smoothstep(0.24, 0.72, foamA * 0.78 + foamB * 0.32));
        wakeFoam = max(wakeFoam, centerMask * smoothstep(0.18, 0.68, foamA * 0.72 + foamB * 0.44));
        wakeTurbulence = max(wakeTurbulence, innerMask);
      }
    }

    // Subtle organic whitecaps
    float crestNoise = snoise(vWorldPos.xz * 0.34 + uTime * 0.25);
    float whitecap = smoothstep(0.60, 0.88, vWaveHeight + crestNoise * 0.26) * 0.22;

    col = mix(col, mix(uWaterSss, vec3(0.76, 0.97, 0.99), 0.36), clamp(wakeTurbulence, 0.0, 0.58));

    float totalFoam = clamp(wakeFoam * 1.18 + shoreFoam * 0.88 + whitecap, 0.0, 1.0);
    vec3 foamCol = mix(vec3(0.86, 0.96, 0.98), vec3(1.0), 0.78) * (0.86 + 0.18 * uSunColor);
    col = mix(col, foamCol, totalFoam);

    // Smooth atmospheric horizon fog
    float fogFactor = smoothstep(uFogNear, uFogFar, dist);
    col = mix(col, uFogColor, fogFactor);

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createOcean(scene, islands = []) {
  const { waveA, waveB } = getWaveUniforms();
  const preset = TIME_PRESETS.noon;

  const wakeArray = [];
  for (let i = 0; i < MAX_WAKE_POINTS; i++) {
    wakeArray.push(new THREE.Vector4(0, 0, 99, 0));
  }

  const islandArray = [];
  for (let i = 0; i < MAX_ISLANDS; i++) {
    if (i < islands.length) {
      islandArray.push(new THREE.Vector4(islands[i].x, islands[i].z, islands[i].radius, 0));
    } else {
      islandArray.push(new THREE.Vector4(99999, 99999, 1, 0));
    }
  }

  // Ultra-smooth dense mesh around the boat (~1.8m vertex spacing near hull!)
  const geo = new THREE.PlaneGeometry(460, 460, 240, 240);
  geo.rotateX(-Math.PI * 0.5);

  const mat = new THREE.ShaderMaterial({
    vertexShader: OCEAN_VERT,
    fragmentShader: OCEAN_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uWaveA: { value: waveA },
      uWaveB: { value: waveB },
      uCenter: { value: new THREE.Vector2(0, 0) },
      uSunDir: { value: preset.sunDir.clone() },
      uSunColor: { value: preset.sunColor.clone() },
      uSkyHorizon: { value: preset.horizon.clone() },
      uSkyZenith: { value: preset.zenith.clone() },
      uWaterDeep: { value: preset.waterDeep.clone() },
      uWaterShallow: { value: preset.waterShallow.clone() },
      uWaterSss: { value: preset.waterSss.clone() },
      uFogColor: { value: preset.fogColor.clone() },
      uFogNear: { value: 390.0 },
      uFogFar: { value: 2100.0 },
      uWake: { value: wakeArray },
      uIslands: { value: islandArray },
      uIslandCount: { value: Math.min(islands.length, MAX_ISLANDS) }
    }
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  scene.add(mesh);

  let lastEmitX = 0;
  let lastEmitZ = 0;
  let hasEmitted = false;

  function pushWakeSample(x, z, intensity) {
    for (let i = MAX_WAKE_POINTS - 1; i > 0; i--) {
      wakeArray[i].copy(wakeArray[i - 1]);
    }
    wakeArray[0].set(x, z, 0, intensity);
    lastEmitX = x;
    lastEmitZ = z;
    hasEmitted = true;
  }

  function applyPreset(name) {
    const p = TIME_PRESETS[name] || TIME_PRESETS.noon;
    mat.uniforms.uSunDir.value.copy(p.sunDir);
    mat.uniforms.uSunColor.value.copy(p.sunColor);
    mat.uniforms.uSkyHorizon.value.copy(p.horizon);
    mat.uniforms.uSkyZenith.value.copy(p.zenith);
    mat.uniforms.uWaterDeep.value.copy(p.waterDeep);
    mat.uniforms.uWaterShallow.value.copy(p.waterShallow);
    mat.uniforms.uWaterSss.value.copy(p.waterSss);
    mat.uniforms.uFogColor.value.copy(p.fogColor);
  }

  function update(time, dt, boatPos, sternPos, boatSpeed) {
    mat.uniforms.uTime.value = time;

    // Fine grid snap (matching ~1.916m cell size) eliminates any wave swimming
    const snap = 460 / 240;
    mat.uniforms.uCenter.value.set(
      Math.round(boatPos.x / snap) * snap,
      Math.round(boatPos.z / snap) * snap
    );

    for (let i = 0; i < MAX_WAKE_POINTS; i++) {
      if (wakeArray[i].w > 0.001) {
        wakeArray[i].z += dt;
        if (wakeArray[i].z > 5.2) {
          wakeArray[i].w = 0;
        }
      }
    }

    const moved = hasEmitted ? Math.hypot(sternPos.x - lastEmitX, sternPos.z - lastEmitZ) : 999;
    const speedFactor = THREE.MathUtils.clamp(Math.abs(boatSpeed) / 14.0, 0, 1.35);
    if (moved > 1.65 && speedFactor > 0.08) {
      pushWakeSample(sternPos.x, sternPos.z, speedFactor);
    } else if (hasEmitted && speedFactor > 0.08) {
      wakeArray[0].x = sternPos.x;
      wakeArray[0].y = sternPos.z;
      wakeArray[0].z = 0;
      wakeArray[0].w = Math.max(wakeArray[0].w, speedFactor);
    }
  }

  return { mesh, mat, applyPreset, update };
}
