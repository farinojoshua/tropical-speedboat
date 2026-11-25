import * as THREE from 'three';

/**
 * Manages the GTA-style translucent turquoise minimap, floating pink screen-space
 * waypoint chevron, speedometer, boost bar, timer, and toast notifications.
 */
export function createHud() {
  const minimapCanvas = document.getElementById('minimap-canvas');
  const ctx = minimapCanvas.getContext('2d');
  const northEl = document.getElementById('minimap-north');
  const wpEdgeEl = document.getElementById('minimap-wp-edge');
  const waypointEl = document.getElementById('waypoint-marker');
  const waypointDistEl = document.getElementById('waypoint-dist');

  const speedEl = document.getElementById('speed-value');
  const boostFillEl = document.getElementById('boost-fill');
  const modeLabelEl = document.getElementById('mode-label');
  const cpCounterEl = document.getElementById('cp-counter');
  const timerEl = document.getElementById('timer-display');
  const toastEl = document.getElementById('toast');

  const projVec = new THREE.Vector3();
  let toastTimeout = null;

  function showToast(text, durationMs = 1900) {
    toastEl.textContent = text;
    toastEl.classList.remove('hidden');
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toastEl.classList.add('hidden');
    }, durationMs);
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const tenths = Math.floor((sec % 1) * 10);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${tenths}`;
  }

  function clampToRectBorder(dx, dy, halfW, halfH) {
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (absX < 0.0001 && absY < 0.0001) return { x: 0, y: -halfH };
    const sx = absX > 0.0001 ? halfW / absX : Infinity;
    const sy = absY > 0.0001 ? halfH / absY : Infinity;
    const s = Math.min(sx, sy);
    return { x: dx * s, y: dy * s };
  }

  function update({
    boatPos,
    boatYaw,
    speedKnots,
    boost,
    mode,
    cpIndex,
    cpTotal,
    runTime,
    activeWaypoint,
    islands,
    npcVessels,
    camera
  }) {
    // Speed & boost
    speedEl.textContent = String(Math.round(Math.abs(speedKnots)));
    boostFillEl.style.width = `${Math.round(boost * 100)}%`;

    // Mode & timer pill
    if (mode === 'run') {
      modeLabelEl.textContent = 'ISLAND RUN';
      cpCounterEl.textContent = `${cpIndex} / ${cpTotal}`;
      timerEl.textContent = formatTime(runTime);
    } else {
      modeLabelEl.textContent = 'FREE ROAM';
      cpCounterEl.textContent = 'OPEN BAY';
      timerEl.textContent = 'LEONIDA KEYS';
    }

    // --- Render GTA-style translucent turquoise minimap ---
    const w = minimapCanvas.width;
    const h = minimapCanvas.height;
    ctx.clearRect(0, 0, w, h);

    // Subtle diagonal marine radar sheen
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, 'rgba(92, 182, 200, 0.25)');
    grad.addColorStop(1, 'rgba(30, 96, 118, 0.28)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle chart grid lines
    ctx.strokeStyle = 'rgba(210, 248, 255, 0.11)';
    ctx.lineWidth = 1;
    for (let gx = 40; gx < w; gx += 40) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
    }
    for (let gy = 39; gy < h; gy += 39) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
    }

    // Player sits slightly below center (like the screenshot!) facing UP
    const px = w * 0.5;
    const py = h * 0.72;
    const scale = 0.28; // world meters -> minimap px
    const cosY = Math.cos(boatYaw);
    const sinY = Math.sin(boatYaw);

    function worldToRadar(wx, wz) {
      const dx = wx - boatPos.x;
      const dz = wz - boatPos.z;
      // Rotate into boat-local frame (forward -Z becomes -Y up on radar)
      const localRight = dx * cosY - dz * sinY;
      const localBack = dx * sinY + dz * cosY;
      return {
        x: px + localRight * scale,
        y: py + localBack * scale
      };
    }

    // Draw islands as soft turquoise-tinted land silhouettes
    for (const isl of islands) {
      const p = worldToRadar(isl.x, isl.z);
      const r = isl.radius * scale;
      // Shallow water halo
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(130, 232, 238, 0.24)';
      ctx.fill();

      // Island landmass
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(34, 96, 98, 0.72)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(220, 245, 240, 0.45)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // Draw NPC vessels as subtle white/cyan dots
    for (const v of npcVessels) {
      const p = worldToRadar(v.mesh.position.x, v.mesh.position.z);
      if (p.x >= -4 && p.x <= w + 4 && p.y >= -4 && p.y <= h + 4) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(235, 250, 255, 0.85)';
        ctx.fill();
      }
    }

    // Draw active pink waypoint (inside map or pinned cleanly to border edge!)
    const wrapW = minimapCanvas.clientWidth || 240;
    const wrapH = minimapCanvas.clientHeight || 156;
    if (activeWaypoint) {
      const wp = worldToRadar(activeWaypoint.x, activeWaypoint.z);
      const margin = 8;
      const inside = wp.x >= margin && wp.x <= w - margin && wp.y >= margin && wp.y <= h - margin;

      if (inside) {
        wpEdgeEl.classList.add('hidden');
        ctx.beginPath();
        ctx.arc(wp.x, wp.y, 6.2, 0, Math.PI * 2);
        ctx.fillStyle = '#ff3898';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        // Pin glowing pink dot onto the minimap border (exact screenshot detail!)
        const border = clampToRectBorder(wp.x - w * 0.5, wp.y - h * 0.5, wrapW * 0.5, wrapH * 0.5);
        wpEdgeEl.style.left = `${wrapW * 0.5 + border.x}px`;
        wpEdgeEl.style.top = `${wrapH * 0.5 + border.y}px`;
        wpEdgeEl.classList.remove('hidden');
      }
    } else {
      wpEdgeEl.classList.add('hidden');
    }

    // Draw Player black-circle + crisp white heading arrow (exact screenshot detail!)
    ctx.save();
    ctx.translate(px, py);
    ctx.beginPath();
    ctx.arc(0, 0, 8.5, 0, Math.PI * 2);
    ctx.fillStyle = '#11161c';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, -5.2);
    ctx.lineTo(4.2, 4.2);
    ctx.lineTo(0, 2.0);
    ctx.lineTo(-4.2, 4.2);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();

    // Position orbiting 'N' North badge along the minimap border
    // World North is -Z -> in radar frame: (sinY, -cosY)
    const northBorder = clampToRectBorder(Math.sin(boatYaw), -Math.cos(boatYaw), wrapW * 0.5, wrapH * 0.5);
    northEl.style.left = `${wrapW * 0.5 + northBorder.x}px`;
    northEl.style.top = `${wrapH * 0.5 + northBorder.y}px`;

    // --- Project 3D floating pink waypoint chevron onto viewport ---
    if (activeWaypoint) {
      projVec.set(activeWaypoint.x, 8.5, activeWaypoint.z);
      const distMeters = Math.round(Math.hypot(activeWaypoint.x - boatPos.x, activeWaypoint.z - boatPos.z));
      projVec.project(camera);

      const isInFront = projVec.z < 1.0;
      const sx = (projVec.x * 0.5 + 0.5) * window.innerWidth;
      const sy = (-projVec.y * 0.5 + 0.5) * window.innerHeight;

      if (isInFront && sx > 24 && sx < window.innerWidth - 24 && sy > 36 && sy < window.innerHeight - 24) {
        waypointEl.classList.remove('hidden');
        waypointEl.style.left = `${sx}px`;
        waypointEl.style.top = `${sy}px`;
        waypointDistEl.textContent = `${distMeters}m`;
      } else {
        // Clamp indicator to screen edge when off-camera so player always knows where to steer
        waypointEl.classList.remove('hidden');
        const dirX = isInFront ? projVec.x : -projVec.x;
        const dirY = isInFront ? -projVec.y : projVec.y;
        const pad = 44;
        const clamped = clampToRectBorder(
          dirX,
          dirY,
          window.innerWidth * 0.5 - pad,
          window.innerHeight * 0.5 - pad
        );
        waypointEl.style.left = `${window.innerWidth * 0.5 + clamped.x}px`;
        waypointEl.style.top = `${window.innerHeight * 0.5 + clamped.y}px`;
        waypointDistEl.textContent = `${distMeters}m`;
      }
    } else {
      waypointEl.classList.add('hidden');
    }
  }

  return { update, showToast, formatTime };
}
