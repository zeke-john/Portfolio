import { useEffect, useRef, useState } from "react";
import { FRAG, SPLAT_FRAG, VERT } from "./shader";

// The sun and moon ride one orbit, opposite each other, and the orbit turns
// on its own. The orbit *is* the clock: it is centred on the horizon, so the
// sun rises on the right at 6:30am, peaks at noon and sets on the left at
// 6:30pm, with the moon doing the opposite. It starts at the real Seattle time and
// then runs fast. Dragging a body moves it freely; on release it eases back
// onto the orbit, carrying the clock with it.
// Positions are uv space: x 0..1 left→right, y 0..1 bottom→top.
const ORBIT = { cx: 0.6, cy: 0.46, rx: 0.42, ry: 0.40 };
const HORIZON = 0.46;
const DAY_SECONDS = 300; // one full cycle of the clock
const TIME_ZONE = "America/Los_Angeles";
// A rain spell every few minutes, fading in and out over several seconds.
const RAIN_PERIOD = 200, RAIN_START = 110, RAIN_LENGTH = 45, RAIN_RAMP = 8;
function rainAt(seconds: number) {
  const c = seconds % RAIN_PERIOD;
  const on = smoothstep(RAIN_START, RAIN_START + RAIN_RAMP, c);
  const off = 1 - smoothstep(RAIN_START + RAIN_LENGTH, RAIN_START + RAIN_LENGTH + RAIN_RAMP, c);
  return on * off;
}

const TAU = Math.PI * 2;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

// Portrait screens bend screen-y so the horizon sits lower; mirror of the
// shader's yMap so the dragged bodies and the painted ones agree.
const KNEE = 0.34;
function sceneY(y: number, portrait: boolean) {
  if (!portrait) return y;
  const H = HORIZON;
  return y < KNEE ? y * (H / KNEE) : H + (y - KNEE) * ((1 - H) / (1 - KNEE));
}
function screenY(sy: number, portrait: boolean) {
  if (!portrait) return sy;
  const H = HORIZON;
  return sy < H ? sy * (KNEE / H) : KNEE + (sy - H) * ((1 - KNEE) / (1 - H));
}

function orbitPoint(phase: number) {
  return { x: ORBIT.cx + ORBIT.rx * Math.cos(phase), y: ORBIT.cy + ORBIT.ry * Math.sin(phase) };
}
function phaseFor(x: number, y: number) {
  return Math.atan2((y - ORBIT.cy) / ORBIT.ry, (x - ORBIT.cx) / ORBIT.rx);
}
// phase 0 = 6:30am (sunrise), π/2 = 12:30pm, π = 6:30pm (sunset)
const SUNRISE = 6.5;
function phaseToHours(phase: number) {
  return (((phase / TAU) * 24 + SUNRISE) % 24 + 24) % 24;
}
function hoursToPhase(hours: number) {
  return ((hours - SUNRISE) / 24) * TAU;
}
function localHoursNow() {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: TIME_ZONE, hour: "numeric", minute: "numeric", hourCycle: "h23",
    }).formatToParts(new Date());
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    return get("hour") + get("minute") / 60;
  } catch {
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60;
  }
}
function formatHours(hours: number) {
  const total = Math.floor(hours * 60);
  const h24 = Math.floor(total / 60) % 24;
  const m = total % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h24 < 12 ? "am" : "pm"}`;
}

// Night follows the clock: it gets dark just after the 6:30pm sunset and
// light again just after the 6:30am sunrise.
export function nightFor(hours: number) {
  return hours >= 12 ? smoothstep(18.4, 19.2, hours) : 1 - smoothstep(6.0, 6.8, hours);
}
function duskFor(sunY: number) {
  return 1 - smoothstep(0, 0.18, Math.abs(sunY - HORIZON + 0.02));
}

// Ink for the page text: dark by day, white by night. A hard switch, never a
// blend, so it's always one or the other.
const NIGHT_THRESHOLD = 0.28;
function inkFor(night: number) {
  return night > NIGHT_THRESHOLD ? "#f4f2ea" : "#1a1816";
}

type Body = "sun" | "moon";

export default function Meadow() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sunRef = useRef<HTMLDivElement>(null);
  const moonRef = useRef<HTMLDivElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    const sunEl = sunRef.current;
    const moonEl = moonRef.current;
    const clockEl = clockRef.current;
    if (!canvas || !sunEl || !moonEl || !clockEl) return;

    const gl = canvas.getContext("webgl", {
      antialias: false,
      alpha: false,
      powerPreference: "low-power",
    });
    if (!gl || gl.isContextLost()) {
      setSupported(false);
      return;
    }

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const forceRain = location.hash === "#rain"; // preview the rain spell
    // Phones get a still painting: one frame at the real time of day, then
    // nothing runs. No handles, no trail, no clock.
    const isStatic = matchMedia("(pointer: coarse)").matches || window.innerWidth < 760;
    document.documentElement.dataset.static = isStatic ? "1" : "0";

    // --------------------------------------------------------- programs ----
    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(sh));
        throw new Error("shader failed");
      }
      return sh;
    };
    const link = (frag: string) => {
      const prog = gl.createProgram()!;
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, frag));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("link failed");
      return prog;
    };
    let scene: WebGLProgram, splat: WebGLProgram;
    try {
      scene = link(FRAG);
      splat = link(SPLAT_FRAG);
    } catch {
      setSupported(false);
      return;
    }

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    for (const prog of [scene, splat]) {
      const aPos = gl.getAttribLocation(prog, "aPos");
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    }

    const loc = (prog: WebGLProgram, name: string) => gl.getUniformLocation(prog, name);
    const us = {
      res: loc(scene, "uRes"), time: loc(scene, "uTime"), sun: loc(scene, "uSun"),
      moon: loc(scene, "uMoon"), night: loc(scene, "uNight"), dusk: loc(scene, "uDusk"),
      seed: loc(scene, "uSeed"), knee: loc(scene, "uKnee"), flow: loc(scene, "uFlow"),
      sunHover: loc(scene, "uSunHover"), moonHover: loc(scene, "uMoonHover"),
      rain: loc(scene, "uRain"),
    };
    const up = {
      prev: loc(splat, "uPrev"), a: loc(splat, "uA"), b: loc(splat, "uB"), vel: loc(splat, "uVel"),
      aspect: loc(splat, "uAspect"), radius: loc(splat, "uRadius"), active: loc(splat, "uActive"),
      decay: loc(splat, "uDecay"),
    };
    gl.useProgram(scene);
    gl.uniform1f(us.seed, 3.7);
    gl.uniform1i(us.flow, 0);
    gl.useProgram(splat);
    gl.uniform1i(up.prev, 0);

    // ---------------------------------------------- wet-paint flow texture ----
    const FLOW_W = 256;
    let flowH = 144;
    const makeTarget = () => {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fbo = gl.createFramebuffer()!;
      return { tex, fbo };
    };
    const targets = [makeTarget(), makeTarget()];
    let readIdx = 0;
    const sizeTargets = () => {
      for (const t of targets) {
        gl.bindTexture(gl.TEXTURE_2D, t.tex);
        // start "dry": velocity 0 (encoded 0.5), wetness 0
        const px = new Uint8Array(FLOW_W * flowH * 4);
        for (let i = 0; i < px.length; i += 4) { px[i] = 128; px[i + 1] = 128; px[i + 2] = 0; px[i + 3] = 255; }
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, FLOW_W, flowH, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
        gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.tex, 0);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    };

    // ------------------------------------------------------------- size ----
    let w = 1, h = 1, portrait = false, aspect = 1;
    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      aspect = w / h;
      portrait = w < h;
      flowH = Math.max(16, Math.round(FLOW_W / aspect));
      sizeTargets();
      // the paint hides a low internal resolution, so cap it hard
      const scale = Math.min(window.devicePixelRatio || 1, 1.5, 1400 / w);
      canvas.width = Math.max(1, Math.floor(w * scale));
      canvas.height = Math.max(1, Math.floor(h * scale));
      gl.useProgram(scene);
      gl.uniform1f(us.knee, portrait ? KNEE : 0);
      gl.uniform2f(us.res, canvas.width, canvas.height);
      gl.useProgram(splat);
      gl.uniform1f(up.aspect, aspect);
      if (isStatic) {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(frame); // one fresh frame for the new size
      }
    };

    // ------------------------------------------------------------ orbit ----
    let phase = hoursToPhase(localHoursNow());
    let dragging: Body | null = null;
    // free-drag offset from the orbit point, eased back to zero on release
    const offset: Record<Body, { x: number; y: number }> = { sun: { x: 0, y: 0 }, moon: { x: 0, y: 0 } };
    const hover: Record<Body, number> = { sun: 0, moon: 0 };
    const hoverTarget: Record<Body, number> = { sun: 0, moon: 0 };
    let lastTick = performance.now();
    const t0 = lastTick;

    const bodyPos = (which: Body) => {
      const o = orbitPoint(phase + (which === "moon" ? Math.PI : 0));
      return { x: o.x + offset[which].x, y: o.y + offset[which].y };
    };
    const place = (el: HTMLDivElement, p: { x: number; y: number }) => {
      el.style.transform = `translate(${p.x * w}px, ${(1 - screenY(p.y, portrait)) * h}px)`;
    };

    const applyNight = (() => {
      let last = -1;
      return (night: number) => {
        if (Math.abs(night - last) < 0.005) return;
        last = night;
        const root = document.documentElement;
        root.style.setProperty("--ink", inkFor(night));
        root.style.setProperty("--night", night.toFixed(3));
        root.dataset.night = night > NIGHT_THRESHOLD ? "1" : "0";
      };
    })();
    let lastClock = "";
    const applyClock = () => {
      const txt = formatHours(phaseToHours(phase));
      if (txt !== lastClock) { lastClock = txt; clockEl.textContent = txt; }
    };

    // ---------------------------------------------------------- pointer ----
    // Trail over the whole page: the canvas can't take events, so watch the window.
    const ptr = { x: -1, y: -1, px: -1, py: -1, has: false, moved: false };
    const onWindowMove = (e: PointerEvent) => {
      ptr.x = e.clientX / w;
      ptr.y = 1 - e.clientY / h;
      if (!ptr.has) { ptr.px = ptr.x; ptr.py = ptr.y; ptr.has = true; }
      ptr.moved = true;
    };
    const onWindowLeave = () => { ptr.has = false; ptr.moved = false; };
    if (!isStatic) {
      window.addEventListener("pointermove", onWindowMove, { passive: true });
      window.addEventListener("pointerdown", onWindowMove, { passive: true });
      document.addEventListener("pointerleave", onWindowLeave);
    }

    const bind = (el: HTMLDivElement, which: Body) => {
      const grabAt = { x: 0, y: 0 };
      const onDown = (e: PointerEvent) => {
        dragging = which;
        const p = bodyPos(which);
        grabAt.x = e.clientX / w - p.x;
        grabAt.y = sceneY(1 - e.clientY / h, portrait) - p.y;
        try { el.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
        el.classList.add("grabbing");
        e.preventDefault();
      };
      const onMove = (e: PointerEvent) => {
        if (dragging !== which) return;
        // the body sits under the cursor; the orbit's phase follows the body
        const x = clamp(e.clientX / w - grabAt.x, -0.1, 1.1);
        const y = clamp(sceneY(1 - e.clientY / h, portrait) - grabAt.y, -0.2, 1.1);
        phase = phaseFor(x, y) + (which === "moon" ? Math.PI : 0);
        const o = orbitPoint(phase + (which === "moon" ? Math.PI : 0));
        offset[which].x = x - o.x;
        offset[which].y = y - o.y;
      };
      const onUp = () => {
        if (dragging === which) dragging = null;
        el.classList.remove("grabbing");
      };
      const onEnter = () => { hoverTarget[which] = 1; };
      const onLeave = () => { hoverTarget[which] = 0; };
      el.addEventListener("pointerdown", onDown);
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", onUp);
      el.addEventListener("pointercancel", onUp);
      el.addEventListener("pointerenter", onEnter);
      el.addEventListener("pointerleave", onLeave);
      return () => {
        el.removeEventListener("pointerdown", onDown);
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", onUp);
        el.removeEventListener("pointercancel", onUp);
        el.removeEventListener("pointerenter", onEnter);
        el.removeEventListener("pointerleave", onLeave);
      };
    };
    const unbindSun = isStatic ? () => {} : bind(sunEl, "sun");
    const unbindMoon = isStatic ? () => {} : bind(moonEl, "moon");

    // ------------------------------------------------------------- loop ----
    let raf = 0;
    let lastFrame = 0;
    const frame = (now: number) => {
      if (!isStatic) raf = requestAnimationFrame(frame);
      // 30fps when idle keeps laptops cool; full rate while dragging or painting
      const busy = dragging !== null || ptr.moved;
      if (!busy && now - lastFrame < 33) return;
      const dt = Math.min(0.1, (now - lastTick) / 1000);
      lastFrame = now;
      lastTick = now;

      if (!reduced && !dragging && !isStatic) phase += (dt * TAU) / DAY_SECONDS;

      // released bodies drift back onto the orbit
      for (const b of ["sun", "moon"] as Body[]) {
        if (dragging !== b) {
          const k = Math.exp(-dt * 6);
          offset[b].x *= k;
          offset[b].y *= k;
        }
        hover[b] += (hoverTarget[b] - hover[b]) * Math.min(1, dt * 10);
      }

      const sun = bodyPos("sun");
      const moon = bodyPos("moon");
      place(sunEl, sun);
      place(moonEl, moon);
      const night = nightFor(phaseToHours(phase));
      applyNight(night);
      applyClock();

      // 1) wet-paint trail
      const write = targets[1 - readIdx];
      gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo);
      gl.viewport(0, 0, FLOW_W, flowH);
      gl.useProgram(splat);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, targets[readIdx].tex);
      const active = ptr.has && ptr.moved;
      if (active) {
        const vx = clamp((ptr.x - ptr.px) * 80, -1, 1);
        const vy = clamp((ptr.y - ptr.py) * 80, -1, 1);
        gl.uniform2f(up.a, ptr.px, ptr.py);
        gl.uniform2f(up.b, ptr.x, ptr.y);
        gl.uniform2f(up.vel, vx, vy);
      }
      gl.uniform1f(up.active, active ? 1 : 0);
      gl.uniform1f(up.radius, 0.06);
      gl.uniform1f(up.decay, Math.pow(0.45, dt)); // wet for a couple of seconds // wet for a couple of seconds
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      ptr.px = ptr.x; ptr.py = ptr.y; ptr.moved = false;
      readIdx = 1 - readIdx;

      // 2) the painting
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(scene);
      gl.bindTexture(gl.TEXTURE_2D, targets[readIdx].tex);
      gl.uniform1f(us.time, reduced || isStatic ? 0 : (now - t0) / 1000);
      gl.uniform2f(us.sun, sun.x, sun.y);
      gl.uniform2f(us.moon, moon.x, moon.y);
      gl.uniform1f(us.night, night);
      gl.uniform1f(us.dusk, duskFor(sun.y));
      gl.uniform1f(us.sunHover, hover.sun);
      gl.uniform1f(us.moonHover, hover.moon);
      gl.uniform1f(us.rain, forceRain ? 1 : reduced || isStatic ? 0 : rainAt((now - t0) / 1000));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    resize();
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(frame);
    canvas.dataset.ready = "1";

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onWindowMove);
      window.removeEventListener("pointerdown", onWindowMove);
      document.removeEventListener("pointerleave", onWindowLeave);
      unbindSun();
      unbindMoon();
      // Don't lose the context here: React StrictMode remounts in dev, and a
      // lost context can't be reused. Drop our objects and let the next
      // mount build fresh ones on the same context.
      gl.deleteProgram(scene);
      gl.deleteProgram(splat);
      gl.deleteBuffer(buf);
      for (const t of targets) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fbo); }
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="meadow"
        aria-hidden="true"
        data-supported={supported ? "1" : "0"}
      />
      <div ref={sunRef} className="sky-handle" aria-label="drag the sun" role="slider" />
      <div ref={moonRef} className="sky-handle" aria-label="drag the moon" role="slider" />
      <div className="clock" aria-live="off">
        <span ref={clockRef} className="clock-time" />
      </div>
    </>
  );
}
