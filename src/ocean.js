import * as THREE from 'three';
import { getWaveUniforms } from './waves.js';
import { TIME_PRESETS } from './sky.js';

const MAX_WAKE_POINTS = 42;
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
    // Non-linear radial expansion: ultra-dense mesh around boat, stretches seamlessly to horizon
    vec2 local = position.xz;
    float dist = length(local);
    float stretch = 1.0 + pow(max(dist / 360.0, 0.0001), 2.2) * 3.4;
    vec2 worldXZ = uCenter + local * stretch;

    float y = 0.0;
    float dYdX = 0.0;
    float dYdZ = 0.0;

    // Fade vertical displacement smoothly near far horizon to eliminate aliasing
    float waveFade = 1.0 - smoothstep(420.0, 1500.0, length(worldXZ - uCenter));

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

  // Wake history: (x, z, age, speedIntensity)
  uniform vec4 uWake[${MAX_WAKE_POINTS}];
  // Island footprints: (x, z, radius, 0)
  uniform vec4 uIslands[${MAX_ISLANDS}];
  uniform int uIslandCount;

  varying vec3 vWorldPos;
  varying vec3 vWaveNormal;
  varying float vWaveHeight;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = rot * p * 2.05;
      a *= 0.5;
    }
    return v;
  }

  // Analytical multi-octave capillary ripple normal for sparkling sun glitter
  vec3 computeRippleNormal(vec2 p, float distToCam) {
    float detailFade = 1.0 - smoothstep(140.0, 950.0, distToCam);
    float eps = 0.18;

    vec2 p1 = p * 0.24 + vec2(uTime * 0.36, -uTime * 0.22);
    vec2 p2 = p * 0.55 + vec2(-uTime * 0.44, uTime * 0.38);
    vec2 p3 = p * 1.15 + vec2(uTime * 0.62, uTime * 0.52);

    float h0 = noise(p1) * 0.52 + noise(p2) * 0.31 + noise(p3) * 0.17;
    float hx = noise(p1 + vec2(eps, 0.0)) * 0.52 + noise(p2 + vec2(eps * 1.8, 0.0)) * 0.31 + noise(p3 + vec2(eps * 2.8, 0.0)) * 0.17;
    float hz = noise(p1 + vec2(0.0, eps)) * 0.52 + noise(p2 + vec2(0.0, eps * 1.8)) * 0.31 + noise(p3 + vec2(0.0, eps * 2.8)) * 0.17;

    float strength = 0.34 * detailFade + 0.09;
    return normalize(vec3((h0 - hx) * strength / eps, 1.0, (h0 - hz) * strength / eps));
  }

  void main() {
    vec3 viewVec = cameraPosition - vWorldPos;
    float dist = length(viewVec);
    vec3 V = viewVec / max(dist, 0.0001);
    vec3 L = normalize(uSunDir);

    // Combine macro Gerstner normal with animated capillary ripples
    vec3 rippleN = computeRippleNormal(vWorldPos.xz, dist);
    vec3 N = normalize(vec3(
      vWaveNormal.x + rippleN.x * 0.62,
      vWaveNormal.y,
      vWaveNormal.z + rippleN.z * 0.62
    ));

    // Island proximity -> vibrant Caribbean shallow turquoise & lapping surf
    float shallowFactor = 0.0;
    float shoreFoam = 0.0;
    for (int i = 0; i < ${MAX_ISLANDS}; i++) {
      if (i >= uIslandCount) break;
      vec4 isl = uIslands[i];
      float d = length(vWorldPos.xz - isl.xy) - isl.z;
      shallowFactor = max(shallowFactor, 1.0 - smoothstep(0.0, 48.0, d));
      float waveLap = sin(d * 0.85 - uTime * 2.4 + noise(vWorldPos.xz * 0.25) * 4.0);
      float shoreBand = (1.0 - smoothstep(-2.0, 5.5, d)) * smoothstep(-4.5, 0.5, d);
      shoreFoam = max(shoreFoam, shoreBand * smoothstep(0.1, 0.8, waveLap * 0.5 + 0.5));
    }

    // Fresnel term (Schlick)
    float NdotV = clamp(dot(N, V), 0.001, 0.999);
    float fresnel = 0.03 + 0.97 * pow(1.0 - NdotV, 4.2);

    // Base turquoise tropical water shading
    float heightFactor = smoothstep(-0.55, 0.72, vWaveHeight);
    vec3 baseWater = mix(uWaterDeep, uWaterShallow, clamp(0.45 + heightFactor * 0.45 + shallowFactor * 0.55, 0.0, 1.0));

    // Subsurface turquoise glow when sunlight passes through wave crests
    float sss = pow(max(dot(V, -L + N * 0.45), 0.0001), 3.0) * (0.45 + heightFactor * 0.8);
    float crestGlow = smoothstep(0.18, 0.85, vWaveHeight) * 0.35;
    baseWater += uWaterSss * (sss * 0.55 + crestGlow + shallowFactor * 0.16);

    // Reflected sky gradient
    vec3 R = reflect(-V, N);
    float reflY = clamp(R.y, 0.0001, 1.0);
    vec3 skyRefl = mix(uSkyHorizon, uSkyZenith, pow(reflY, 0.55));

    vec3 col = mix(baseWater, skyRefl, clamp(fresnel * 0.82, 0.08, 0.86));

    // Sparkling tropical sun glitter reflection path (matches screenshot!)
    vec3 H = normalize(L + V);
    float NdotH = max(dot(N, H), 0.0001);
    float specSharp = pow(NdotH, 320.0) * 3.8;
    float specMed = pow(NdotH, 52.0) * 0.65;
    float specWide = pow(NdotH, 12.0) * 0.14;
    // Extra crisp glitter sparkles from micro-ripples
    float sparkleNoise = noise(vWorldPos.xz * 2.2 + vec2(uTime * 1.1, -uTime * 0.9));
    float glitter = pow(NdotH, 110.0) * smoothstep(0.58, 0.92, sparkleNoise) * 2.6;
    col += uSunColor * (specSharp + specMed + specWide + glitter);

    // Dynamic twin-V speedboat wake & churning white prop wash
    float wakeFoam = 0.0;
    float wakeTurbulence = 0.0;
    if (dist < 240.0) {
      float foamNoiseA = fbm(vWorldPos.xz * 0.55 + vec2(uTime * 0.45, -uTime * 0.35));
      float foamNoiseB = noise(vWorldPos.xz * 1.85 - vec2(uTime * 0.8, uTime * 0.5));

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
        float life = clamp(1.0 - age / 4.8, 0.0, 1.0);
        if (life <= 0.0) continue;

        // Expanding V-wake Kelvin arms
        float armOffset = 1.65 + age * 4.35;
        float armWidth = 0.85 + age * 1.15;
        float armDist = abs(d - armOffset);
        float armMask = (1.0 - smoothstep(0.0, armWidth, armDist)) * life * intensity;

        // Churning central prop-wash ribbon right behind twin outboards
        float centerWidth = 1.45 + age * 0.72;
        float centerMask = (1.0 - smoothstep(0.0, centerWidth, d)) * pow(life, 1.35) * intensity;

        // Subtle turquoise aerated water inside the V-wake
        float innerMask = (1.0 - smoothstep(0.0, armOffset, d)) * life * intensity * 0.28;

        wakeFoam = max(wakeFoam, armMask * smoothstep(0.24, 0.72, foamNoiseA + 0.22 * foamNoiseB));
        wakeFoam = max(wakeFoam, centerMask * smoothstep(0.18, 0.68, foamNoiseA * 0.8 + foamNoiseB * 0.45));
        wakeTurbulence = max(wakeTurbulence, innerMask);
      }
    }

    // Subtle open-ocean whitecaps on steepest crests
    float crestNoise = noise(vWorldPos.xz * 0.42 + uTime * 0.3);
    float whitecap = smoothstep(0.58, 0.86, vWaveHeight + crestNoise * 0.25) * 0.24;

    // Aerated bright cyan wash inside wake
    col = mix(col, mix(uWaterSss, vec3(0.75, 0.96, 0.98), 0.35), clamp(wakeTurbulence, 0.0, 0.55));

    // Crisp sunlit white foam
    float totalFoam = clamp(wakeFoam * 1.15 + shoreFoam * 0.85 + whitecap, 0.0, 1.0);
    vec3 foamCol = mix(vec3(0.84, 0.95, 0.97), vec3(1.0), 0.75) * (0.85 + 0.2 * uSunColor);
    col = mix(col, foamCol, totalFoam);

    // Atmospheric horizon distance fog
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

  const geo = new THREE.PlaneGeometry(760, 760, 210, 210);
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
      uFogNear: { value: 380.0 },
      uFogFar: { value: 2050.0 },
      uWake: { value: wakeArray },
      uIslands: { value: islandArray },
      uIslandCount: { value: Math.min(islands.length, MAX_ISLANDS) }
    }
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  scene.add(mesh);

  // Wake history ring state
  let lastEmitX = 0;
  let lastEmitZ = 0;
  let hasEmitted = false;

  function pushWakeSample(x, z, intensity) {
    // Shift wake points back so index 0 is newest
    for (let i = MAX_WAKE_POINTS - 1; i > 0; i--) {
      wakeArray[i].copy(wakeArray[i - 1]);
    }
    wakeArray[0].set(x, z, 0, intensity);
    lastEmitX = x;
    lastEmitZ = z;
    hasEmitted = true;
  }

  function setIslands(newIslands) {
    const count = Math.min(newIslands.length, MAX_ISLANDS);
    mat.uniforms.uIslandCount.value = count;
    for (let i = 0; i < MAX_ISLANDS; i++) {
      if (i < count) {
        islandArray[i].set(newIslands[i].x, newIslands[i].z, newIslands[i].radius, 0);
      } else {
        islandArray[i].set(99999, 99999, 1, 0);
      }
    }
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

    // Snap ocean center to grid intervals so vertices never swim visually
    const snap = 4.0;
    mat.uniforms.uCenter.value.set(
      Math.round(boatPos.x / snap) * snap,
      Math.round(boatPos.z / snap) * snap
    );

    // Age existing wake samples
    for (let i = 0; i < MAX_WAKE_POINTS; i++) {
      if (wakeArray[i].w > 0.001) {
        wakeArray[i].z += dt;
        if (wakeArray[i].z > 5.0) {
          wakeArray[i].w = 0;
        }
      }
    }

    // Emit new wake node when stern moves enough
    const moved = hasEmitted ? Math.hypot(sternPos.x - lastEmitX, sternPos.z - lastEmitZ) : 999;
    const speedFactor = THREE.MathUtils.clamp(Math.abs(boatSpeed) / 14.0, 0, 1.35);
    if (moved > 1.85 && speedFactor > 0.08) {
      pushWakeSample(sternPos.x, sternPos.z, speedFactor);
    } else if (hasEmitted && speedFactor > 0.08) {
      // Continuously tether newest sample to stern for seamless connection
      wakeArray[0].x = sternPos.x;
      wakeArray[0].y = sternPos.z;
      wakeArray[0].z = 0;
      wakeArray[0].w = Math.max(wakeArray[0].w, speedFactor);
    }
  }

  return { mesh, mat, setIslands, applyPreset, update };
}
