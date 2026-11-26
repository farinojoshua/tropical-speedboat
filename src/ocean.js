import * as THREE from 'three';
import { getWaveUniforms } from './waves.js';
import { TIME_PRESETS } from './sky.js';

const MAX_WAKE_POINTS = 64;
const MAX_ISLANDS = 18;

const OCEAN_VERT = /* glsl */ `
  uniform float uTime;
  uniform vec4 uWaveA[6];
  uniform vec4 uWaveB[6];
  uniform vec2 uCenter;
  uniform vec4 uWake[${MAX_WAKE_POINTS}];

  varying vec3 vWorldPos;
  varying vec3 vWaveNormal;
  varying float vWaveHeight;
  varying float vWakeRidge;

  void main() {
    // High-density smooth radial grid around the boat expanding smoothly to horizon
    vec2 local = position.xz;
    float dist = length(local);
    float stretch = 1.0 + pow(max(dist / 215.0, 0.0001), 2.38) * 4.0;
    vec2 baseXZ = uCenter + local * stretch;

    float waveFade = 1.0 - smoothstep(420.0, 1650.0, length(baseXZ - uCenter));

    // True 3D Gerstner trochoidal displacement (horizontal chop + sharpened vertical peaks)
    vec3 disp = vec3(0.0);
    float dYdX = 0.0;
    float dYdZ = 0.0;

    for (int i = 0; i < 6; i++) {
      vec2 dir = uWaveA[i].xy;
      float amp = uWaveA[i].z * waveFade;
      float k = uWaveA[i].w;
      float speed = uWaveB[i].x;
      float steep = uWaveB[i].y;

      float phase = k * dot(dir, baseXZ) + uTime * speed;
      float s = sin(phase);
      float c = cos(phase);

      disp.x += dir.x * (amp * steep * 0.65 * c);
      disp.z += dir.y * (amp * steep * 0.65 * c);
      disp.y += amp * (s + 0.14 * steep * (s * s - 0.5));

      float slope = amp * k * c;
      dYdX += slope * dir.x;
      dYdZ += slope * dir.y;
    }

    // Physical 3D V-wake trough & curling raised wave ridges behind the speedboat!
    float wakeDispY = 0.0;
    float wakeRidge = 0.0;
    if (dist < 165.0) {
      for (int i = 0; i < 28; i += 2) {
        vec4 pA = uWake[i];
        vec4 pB = uWake[i + 2];
        if (pA.w < 0.04 || pB.w < 0.04) continue;
        vec2 seg = pB.xy - pA.xy;
        float lenSq = dot(seg, seg);
        if (lenSq < 0.0001) continue;
        float t = clamp(dot(baseXZ - pA.xy, seg) / lenSq, 0.0, 1.0);
        float d = length(baseXZ - (pA.xy + seg * t));
        float age = mix(pA.z, pB.z, t);
        float intensity = mix(pA.w, pB.w, t);
        float life = clamp(1.0 - age / 4.2, 0.0, 1.0);
        if (life <= 0.0) continue;

        float armPos = 1.65 + age * 4.55;
        // Raised curling wake shoulder + recessed prop trough
        float ridge = exp(-pow((d - armPos) / (1.0 + age * 0.65), 2.0)) * 0.42 * life * intensity;
        float trough = exp(-pow(d / (1.45 + age * 0.5), 2.0)) * 0.24 * life * intensity;
        wakeDispY += ridge - trough;
        wakeRidge = max(wakeRidge, ridge);
      }
    }

    vec3 worldPos = vec3(baseXZ.x + disp.x, disp.y + wakeDispY, baseXZ.y + disp.z);
    vWorldPos = worldPos;
    vWaveHeight = disp.y + wakeDispY;
    vWakeRidge = wakeRidge;
    vWaveNormal = normalize(vec3(-dYdX, 1.0, -dYdZ));

    gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
  }
`;

// GTA VI inspired silky turquoise ocean:
// - 10-octave domain-warped directional capillary wavelets (liquid-glass surface)
// - GGX microfacet specular sun glitter (triggers soft HDR bloom!)
// - Sky + cloud reflection sheen in Fresnel grazing reflections
// - 64-point high-frequency lacy foam V-wake & churning twin-outboard prop wash
const OCEAN_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uSkyHorizon;
  uniform vec3 uSkyZenith;
  uniform vec3 uCloudLight;
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
  varying float vWakeRidge;

  // Isotropic 2D Simplex noise
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
      p = rot * p * 2.07 + vec2(7.3, -4.1);
      a *= 0.48;
    }
    return v;
  }

  // 10-octave liquid-glass analytical capillary wave normal
  vec3 computeLiquidRippleNormal(vec2 p, float distToCam) {
    float detailFade = 1.0 - smoothstep(130.0, 1150.0, distToCam);
    vec2 grad = vec2(0.0);

    float freq = 0.38;
    float amp = 0.095;
    float speed = 1.25;
    mat2 rot = mat2(0.754, 0.656, -0.656, 0.754);
    vec2 dir = vec2(0.84, 0.54);

    for (int i = 0; i < 10; i++) {
      vec2 perp = vec2(-dir.y, dir.x);
      float warp = sin(dot(p, perp) * freq * 0.42 + uTime * 0.55) * 0.9;
      float phase = dot(p, dir) * freq + uTime * speed + warp;
      // Exponential trochoidal wave slope (sharper crests, fluid liquid sheen!)
      float s = sin(phase);
      float c = cos(phase);
      float dWave = c * exp(s * 0.42 - 0.42);
      grad += dir * (dWave * amp * freq);

      // Gently advect sampling coordinates by wave slope for domain-warped organic chop
      p -= dir * (dWave * 0.045);

      dir = rot * dir;
      freq *= 1.32;
      amp *= 0.67;
      speed *= 1.11;
    }

    float strength = mix(0.22, 1.0, detailFade);
    return normalize(vec3(-grad.x * strength, 1.0, -grad.y * strength));
  }

  // GGX Microfacet specular distribution for hyper-realistic water glitter
  float ggxSpecular(float NdotH, float roughness) {
    float a = roughness * roughness;
    float a2 = a * a;
    float denom = (NdotH * NdotH) * (a2 - 1.0) + 1.0;
    return a2 / max(3.14159265 * denom * denom, 0.0001);
  }

  void main() {
    vec3 viewVec = cameraPosition - vWorldPos;
    float dist = length(viewVec);
    vec3 V = viewVec / max(dist, 0.0001);
    vec3 L = normalize(uSunDir);

    vec3 rippleN = computeLiquidRippleNormal(vWorldPos.xz, dist);
    vec3 N = normalize(vec3(
      vWaveNormal.x + rippleN.x * 0.78,
      vWaveNormal.y,
      vWaveNormal.z + rippleN.z * 0.78
    ));

    // Island shallow Caribbean turquoise halo & organic lapping surf
    float shallowFactor = 0.0;
    float shoreFoam = 0.0;
    for (int i = 0; i < ${MAX_ISLANDS}; i++) {
      if (i >= uIslandCount) break;
      vec4 isl = uIslands[i];
      float d = length(vWorldPos.xz - isl.xy) - isl.z;
      shallowFactor = max(shallowFactor, 1.0 - smoothstep(0.0, 56.0, d));
      if (d < 13.0) {
        float nShore = snoise(vWorldPos.xz * 0.19 + uTime * 0.22);
        float waveLap = sin(d * 0.85 - uTime * 2.3 + nShore * 4.4);
        float shoreBand = (1.0 - smoothstep(-2.0, 6.4, d)) * smoothstep(-5.0, 0.6, d);
        shoreFoam = max(shoreFoam, shoreBand * smoothstep(0.06, 0.80, waveLap * 0.5 + 0.5));
      }
    }

    // Physical water Fresnel (F0 = 0.02 for seawater)
    float NdotV = clamp(dot(N, V), 0.001, 0.999);
    float fresnel = 0.02 + 0.98 * pow(1.0 - NdotV, 4.6);

    // Rich GTA VI Leonida Keys turquoise depth & translucent crest scattering
    float heightFactor = smoothstep(-0.52, 0.68, vWaveHeight);
    vec3 deepCol = mix(uWaterDeep, uWaterShallow, clamp(0.42 + heightFactor * 0.45 + shallowFactor * 0.58, 0.0, 1.0));

    // Subsurface turquoise glow when sunlight back-illuminates wave crests & wake ridges
    float backScatter = pow(max(dot(V, -L + N * 0.5), 0.0001), 3.2) * (0.45 + heightFactor * 0.85);
    float crestTransmit = smoothstep(0.14, 0.78, vWaveHeight + vWakeRidge * 0.9) * 0.42;
    deepCol += uWaterSss * (backScatter * 0.58 + crestTransmit + shallowFactor * 0.20);

    // Sky + soft reflected cumulus cloud band on the water surface!
    vec3 R = reflect(-V, N);
    float reflY = clamp(R.y, 0.0001, 1.0);
    vec3 skyRefl = mix(uSkyHorizon, uSkyZenith, pow(reflY, 0.52));
    // Approximate reflected cumulus cloud shimmer
    vec2 reflCloudUV = R.xz / (reflY + 0.35) * 0.65 + vec2(uTime * 0.004, uTime * 0.002);
    float reflCloud = smoothstep(0.48, 0.74, fbm(reflCloudUV)) * smoothstep(0.02, 0.25, reflY) * (1.0 - smoothstep(0.4, 0.85, reflY));
    skyRefl = mix(skyRefl, uCloudLight * 0.96, reflCloud * 0.52);

    vec3 col = mix(deepCol, skyRefl, clamp(fresnel * 0.88, 0.05, 0.90));

    // Dual-lobe GGX sun glitter reflection path (HDR values > 1.0 trigger silky UnrealBloom!)
    vec3 H = normalize(L + V);
    float NdotH = clamp(dot(N, H), 0.0001, 1.0);
    float ggxTight = ggxSpecular(NdotH, 0.042) * 0.045;
    float ggxBroad = ggxSpecular(NdotH, 0.16) * 0.032;
    float microGlitter = pow(NdotH, 160.0) * smoothstep(0.52, 0.92, snoise(vWorldPos.xz * 2.4 + vec2(uTime * 1.25, -uTime * 0.95))) * 3.2;
    col += uSunColor * (ggxTight + ggxBroad + microGlitter) * (0.65 + 0.55 * fresnel);

    // Ultra-smooth 64-node lacy twin-V speedboat wake & churning white prop wash
    float wakeFoam = 0.0;
    float wakeLace = 0.0;
    float wakeTurbulence = 0.0;
    if (dist < 280.0) {
      // Domain-warped organic seafoam patterns (creates realistic lacy streaks!)
      vec2 wPos = vWorldPos.xz;
      vec2 foamWarp = vec2(
        snoise(wPos * 0.32 + vec2(uTime * 0.28, -uTime * 0.22)),
        snoise(wPos * 0.32 - vec2(uTime * 0.22, uTime * 0.26))
      );
      float foamMacro = fbm(wPos * 0.44 + foamWarp * 0.85);
      float foamFine = snoise(wPos * 1.95 + foamWarp * 1.3 - vec2(uTime * 0.65, uTime * 0.4));
      float lacePattern = smoothstep(0.32, 0.66, foamMacro * 0.65 + foamFine * 0.45);

      for (int i = 0; i < ${MAX_WAKE_POINTS - 1}; i++) {
        vec4 pA = uWake[i];
        vec4 pB = uWake[i + 1];
        if (pA.w < 0.02 || pB.w < 0.02) continue;

        vec2 seg = pB.xy - pA.xy;
        float segLenSq = dot(seg, seg);
        if (segLenSq < 0.0001) continue;

        float t = clamp(dot(wPos - pA.xy, seg) / segLenSq, 0.0, 1.0);
        vec2 closest = pA.xy + seg * t;
        float d = length(wPos - closest);

        float age = mix(pA.z, pB.z, t);
        float intensity = mix(pA.w, pB.w, t);
        float life = clamp(1.0 - age / 5.4, 0.0, 1.0);
        if (life <= 0.0) continue;

        // Wide sweeping Kelvin V-arms curling gracefully off both sides of hull
        float armOffset = 1.55 + age * 4.55;
        float armWidth = 1.05 + age * 1.38;
        float armDist = abs(d - armOffset);
        float armCore = (1.0 - smoothstep(0.0, armWidth * 0.62, armDist)) * life * intensity;
        float armSkirt = (1.0 - smoothstep(0.0, armWidth * 1.25, armDist)) * life * intensity;

        // Dense churning central twin-outboard prop wash
        float centerWidth = 1.65 + age * 0.85;
        float centerMask = (1.0 - smoothstep(0.0, centerWidth, d)) * pow(max(life, 0.0001), 1.15) * intensity;

        // Aerated glowing turquoise wash inside the V
        float innerMask = (1.0 - smoothstep(0.0, armOffset + 0.5, d)) * life * intensity * 0.36;

        wakeFoam = max(wakeFoam, armCore * smoothstep(0.18, 0.68, foamMacro * 0.75 + foamFine * 0.38));
        wakeFoam = max(wakeFoam, centerMask * smoothstep(0.14, 0.62, foamMacro * 0.68 + foamFine * 0.48));
        wakeLace = max(wakeLace, armSkirt * lacePattern * 0.55);
        wakeTurbulence = max(wakeTurbulence, innerMask);
      }
    }

    // Natural open-ocean whitecap foam on steep wave crests
    float crestNoise = snoise(vWorldPos.xz * 0.38 + uTime * 0.25);
    float whitecap = smoothstep(0.58, 0.86, vWaveHeight + crestNoise * 0.25) * 0.20;

    // Luminous aerated seafoam-turquoise wash inside wake V
    col = mix(col, mix(uWaterSss, vec3(0.74, 0.97, 0.99), 0.42), clamp(wakeTurbulence, 0.0, 0.62));

    // Sunlit frothy white seafoam with subtle depth shading
    float totalFoam = clamp(wakeFoam * 1.22 + wakeLace + shoreFoam * 0.90 + whitecap, 0.0, 1.0);
    float foamLit = 0.84 + 0.22 * max(dot(N, L), 0.0);
    vec3 foamCol = mix(vec3(0.84, 0.95, 0.97), vec3(1.0), 0.82) * foamLit * (0.88 + 0.16 * uSunColor);
    col = mix(col, foamCol, totalFoam);

    // Smooth atmospheric aerial perspective fog into horizon
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

  // Ultra-fine high-res water mesh around the boat (~1.65m cell spacing!)
  const geo = new THREE.PlaneGeometry(430, 430, 260, 260);
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
      uCloudLight: { value: preset.cloudLight.clone() },
      uWaterDeep: { value: preset.waterDeep.clone() },
      uWaterShallow: { value: preset.waterShallow.clone() },
      uWaterSss: { value: preset.waterSss.clone() },
      uFogColor: { value: preset.fogColor.clone() },
      uFogNear: { value: 400.0 },
      uFogFar: { value: 2150.0 },
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
    mat.uniforms.uCloudLight.value.copy(p.cloudLight);
    mat.uniforms.uWaterDeep.value.copy(p.waterDeep);
    mat.uniforms.uWaterShallow.value.copy(p.waterShallow);
    mat.uniforms.uWaterSss.value.copy(p.waterSss);
    mat.uniforms.uFogColor.value.copy(p.fogColor);
  }

  function update(time, dt, boatPos, sternPos, boatSpeed) {
    mat.uniforms.uTime.value = time;

    const snap = 430 / 260;
    mat.uniforms.uCenter.value.set(
      Math.round(boatPos.x / snap) * snap,
      Math.round(boatPos.z / snap) * snap
    );

    for (let i = 0; i < MAX_WAKE_POINTS; i++) {
      if (wakeArray[i].w > 0.001) {
        wakeArray[i].z += dt;
        if (wakeArray[i].z > 5.5) {
          wakeArray[i].w = 0;
        }
      }
    }

    // High-frequency wake sampling (~0.95m) makes curved turns silky smooth with zero kinks!
    const moved = hasEmitted ? Math.hypot(sternPos.x - lastEmitX, sternPos.z - lastEmitZ) : 999;
    const speedFactor = THREE.MathUtils.clamp(Math.abs(boatSpeed) / 13.0, 0, 1.4);
    if (moved > 0.95 && speedFactor > 0.06) {
      pushWakeSample(sternPos.x, sternPos.z, speedFactor);
    } else if (hasEmitted && speedFactor > 0.06) {
      wakeArray[0].x = sternPos.x;
      wakeArray[0].y = sternPos.z;
      wakeArray[0].z = 0;
      wakeArray[0].w = Math.max(wakeArray[0].w, speedFactor);
    }
  }

  return { mesh, mat, applyPreset, update };
}
