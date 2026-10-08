import { useEffect, useRef, useState } from "react";
import {
  BALL_GRID,
  CALM_BALL,
  RESTING_LIGHT,
  SPARKLE_BALL,
  SPIN,
  ballCells,
  ballSpots,
  lampDirection,
} from "./stageLights";
import { useDesignTheme } from "./useDesignTheme";

/*
 * The stage behind every screen (docs/design/design-system.md, "Themes and the
 * stage"): a disco ball hanging over the dark pink floor, throwing spots
 * of light. Decorative, so hidden from assistive tech and the pointer.
 *
 * - Calm: the ball hangs still, in muted pinks.
 * - Sparkle: pink sequins cover the stage (a WebGL shader), and the ball,
 *   white and light pink, turns slowly with the pointer as its lamp. Its
 *   spots sweep the room left to right, with the ball. With reduced
 *   motion it is one still frame.
 *
 * Where a canvas or WebGL isn't there (an old browser, a test), the stage
 * is the CSS background alone (`--esc-screen`).
 */

/**
 * The ball's diameter and how far below the stage's top edge it hangs,
 * measured from `.esc-stage-ball`, which tokens.css and stage.css size
 * (`--esc-ball-size`, `--esc-ball-hang`): the same values the page
 * header leaves room for. 96px under 56px where it can't be measured.
 */
type BallBox = { size: number; hang: number };
const measureBall = (box: HTMLElement | null): BallBox => ({
  size: box?.offsetWidth || 96,
  hang: box?.offsetTop || 56,
});
/** The longest step the ball turns in one frame, so it never jumps after a hidden tab. */
const MAX_STEP = 0.1;
/** Frames a second while turning: enough for a slow ball. */
const FPS = 30;
/**
 * The most pixels the sequin floor renders; CSS scales it up from there.
 * It is a dimmed backdrop, so a big screen or a dense phone needs no more,
 * and a TV stick keeps its frame rate.
 */
const MAX_SEQUIN_PIXELS = 900_000;

const SEQUINS = `precision highp float;
uniform float t; uniform vec2 m; uniform float s;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
  vec2 p=gl_FragCoord.xy/s;
  float rowH=.74; float j0=floor(p.y/rowH);
  float best=-1e9; vec2 bid=vec2(0.); vec2 bd=vec2(0.); float found=0.;
  for(int dj=-1;dj<=2;dj++){
    float j=j0+float(dj); float off=mod(j,2.)*.5; float i0=floor(p.x-off);
    for(int di=-1;di<=1;di++){
      float i=i0+float(di);
      vec2 c=vec2(i+off+.5,j*rowH+.5); vec2 d=p-c;
      if(length(d)<.64 && -j>best){best=-j; bid=vec2(i,j); bd=d; found=1.;}
    }
  }
  vec3 col=vec3(.14,.0,.08);
  if(found>.5){
    float k=h(bid); float rr=length(bd);
    vec2 tilt=(vec2(h(bid+1.7),h(bid+5.3))-.5)*.8+.22*vec2(sin(t*.8+k*6.28),cos(t*.65+k*9.1));
    vec3 N=normalize(vec3(tilt-bd*.45,1.));
    vec3 L=normalize(vec3(m-gl_FragCoord.xy,520.*s/13.));
    vec3 H=normalize(L+vec3(0.,0.,1.));
    float dif=max(dot(N,L),0.); float sp=pow(max(dot(N,H),0.),90.);
    vec3 base=k<.55?vec3(.88,.07,.45):(k<.85?vec3(.62,.04,.33):vec3(1.,.6,.8));
    vec3 R=reflect(vec3(0.,0.,-1.),N);
    vec3 env=mix(vec3(.25,.0,.14),vec3(1.,.7,.86),smoothstep(-.4,.6,R.y));
    col=base*(.14+.45*dif)+base*env*.3+vec3(1.,.9,.95)*sp*1.3;
    col*=mix(.5,1.,smoothstep(.64,.5,rr));
    col*=mix(.6,1.,smoothstep(.04,.1,rr));
  }
  col=col/(1.+col*.4);
  // Dimmed to a backdrop; stage text keeps its outline over a bright sequin.
  gl_FragColor=vec4(pow(col,vec3(.95))*.62,1.);
}`;

type Sequins = {
  draw: (time: number, lampX: number, lampY: number) => void;
  /** Hand the WebGL context back, so switching themes never piles them up. */
  release: () => void;
};

/** The sequin floor, or null where WebGL isn't there. */
const sequinFloor = (canvas: HTMLCanvasElement): Sequins | null => {
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false }) as WebGLRenderingContext | null;
  if (!gl) return null;
  const shader = (type: number, source: string) => {
    const s = gl.createShader(type);
    if (!s) return null;
    gl.shaderSource(s, source);
    gl.compileShader(s);
    return s;
  };
  // Hand back a context the shader can't run on (no highp, say), so the
  // caller falls back to the CSS stage without holding one open.
  const fail = () => {
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return null;
  };
  const program = gl.createProgram();
  const vertex = shader(gl.VERTEX_SHADER, "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}");
  const fragment = shader(gl.FRAGMENT_SHADER, SEQUINS);
  if (!program || !vertex || !fragment) return fail();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return fail();
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const a = gl.getAttribLocation(program, "a");
  gl.enableVertexAttribArray(a);
  gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
  const u = (name: string) => gl.getUniformLocation(program, name);
  const [ut, um, us] = [u("t"), u("m"), u("s")];

  return {
    release: () => gl.getExtension("WEBGL_lose_context")?.loseContext(),
    draw: (time, lampX, lampY) => {
      if (gl.isContextLost()) return;
      const area = canvas.clientWidth * canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5, area ? Math.sqrt(MAX_SEQUIN_PIXELS / area) : 1);
      const w = Math.round(canvas.clientWidth * dpr);
      const h = Math.round(canvas.clientHeight * dpr);
      if (!w || !h) return;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      gl.uniform1f(ut, time);
      // The lamp, from -1..1 across the stage, in the shader's pixels (y up).
      gl.uniform2f(um, ((lampX + 1) / 2) * w, (1 - (lampY + 1) / 2) * h);
      gl.uniform1f(us, 13 * dpr);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
  };
};

const rgba = ([r, g, b]: readonly number[], a: number) => `rgba(${r}, ${g}, ${b}, ${a})`;

/** Paint the ball and its spots on the lights canvas. */
const paintLights = (canvas: HTMLCanvasElement, ball: BallBox, sparkle: boolean, lampX: number, lampY: number, phase: number) => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  // Soft spots and a small ball: 1.5x is as sharp as they look.
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return;
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const look = sparkle ? SPARKLE_BALL : CALM_BALL;
  const lamp = lampDirection(lampX, lampY);
  const { size, hang: top } = ball;
  const left = (width - size) / 2;
  const centreY = top + size / 2;

  // The spots first, so the ball hangs in front of them: square, slightly
  // leaning mirrors with a soft edge (a faint larger square under a brighter
  // one), and never over the ball's disc, which is cut out of the stage.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.arc(width / 2, centreY, size / 2 + 1, 0, Math.PI * 2);
  ctx.clip("evenodd");
  for (const spot of ballSpots(look, lamp, phase, { width, height, centreY, radius: size / 2 })) {
    ctx.save();
    ctx.translate(spot.x, spot.y);
    ctx.rotate(spot.rotation);
    ctx.fillStyle = rgba(spot.colour, spot.alpha * 0.35);
    ctx.fillRect(-spot.width * 0.65, -spot.height * 0.65, spot.width * 1.3, spot.height * 1.3);
    ctx.fillStyle = rgba(spot.colour, spot.alpha);
    ctx.fillRect(-spot.width / 2, -spot.height / 2, spot.width, spot.height);
    ctx.restore();
  }
  ctx.restore();

  // The ball hangs free, with no wire, on every screen; it is painted a facet at a time.
  ctx.save();
  ctx.beginPath();
  ctx.arc(width / 2, centreY, size / 2, 0, Math.PI * 2);
  ctx.clip();
  const cell = size / BALL_GRID;
  ballCells(look, lamp, phase).forEach((colour, index) => {
    if (!colour) return;
    ctx.fillStyle = rgba(colour, 1);
    ctx.fillRect(left + (index % BALL_GRID) * cell, top + Math.floor(index / BALL_GRID) * cell, cell + 0.5, cell + 0.5);
  });
  // The grout between the mirrors.
  ctx.strokeStyle = "rgba(30, 0, 20, 0.3)";
  ctx.lineWidth = 0.5;
  for (let k = 1; k < BALL_GRID; k += 1) {
    ctx.beginPath();
    ctx.moveTo(left + k * cell, top);
    ctx.lineTo(left + k * cell, top + size);
    ctx.moveTo(left, top + k * cell);
    ctx.lineTo(left + size, top + k * cell);
    ctx.stroke();
  }
  ctx.restore();
};

/*
 * Still when the system asks for reduced motion, or in forced colours,
 * where stage.css hides the stage and a turning ball would only burn frames.
 */
const STILL = "(prefers-reduced-motion: reduce), (forced-colors: active)";

/** Whether the stage should keep still, followed live. */
const usePrefersStill = () => {
  const query = () => (typeof window.matchMedia === "function" ? window.matchMedia(STILL) : null);
  const [still, setStill] = useState(() => query()?.matches ?? false);
  useEffect(() => {
    const media = query();
    if (!media) return;
    const changed = () => setStill(media.matches);
    media.addEventListener?.("change", changed);
    return () => media.removeEventListener?.("change", changed);
  }, []);
  return still;
};

export const Stage = () => {
  const { theme } = useDesignTheme();
  const sparkle = theme === "sparkle";
  const reduced = usePrefersStill();
  const rootRef = useRef<HTMLDivElement>(null);
  const lightsRef = useRef<HTMLCanvasElement>(null);
  const ballRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const lights = lightsRef.current;
    if (!root || !lights) return;

    const still = !sparkle || reduced;
    // A fresh canvas for every run: a released WebGL context can't be
    // reused, and React may run this effect twice on one mount.
    const sequinCanvas = sparkle ? document.createElement("canvas") : null;
    if (sequinCanvas) {
      sequinCanvas.className = "esc-stage-sequins";
      root.insertBefore(sequinCanvas, lights);
    }
    let sequins = sequinCanvas ? sequinFloor(sequinCanvas) : null;
    // No sequins (no WebGL, or a shader the GPU can't run): the CSS stage
    // shows through, never an opaque, empty canvas.
    if (sequinCanvas && !sequins) sequinCanvas.style.display = "none";
    // A lost context (the GPU reset, too many tabs) leaves the CSS stage.
    const lost = () => {
      sequins = null;
      if (sequinCanvas) sequinCanvas.style.display = "none";
    };
    sequinCanvas?.addEventListener("webglcontextlost", lost);
    let lamp: { x: number; y: number } = RESTING_LIGHT;
    let phase = 0.4;
    let last = performance.now();
    let frame = 0;
    let drawn = 0;

    const draw = (now: number) => {
      sequins?.draw(still ? 0 : now / 1000, lamp.x, lamp.y);
      paintLights(lights, ball, sparkle, lamp.x, lamp.y, phase);
    };

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      // A little slack, so a 60Hz display's every other frame always counts.
      if (now - drawn < 1000 / FPS - 4) return;
      const step = Math.min((now - last) / 1000, MAX_STEP);
      phase = (phase + SPIN * step + Math.PI * 2) % (Math.PI * 2);
      last = now;
      drawn = now;
      draw(now);
    };

    // In Sparkle the pointer (or a finger) is the lamp. The stage's box is
    // measured when it resizes (the ResizeObserver below), not per move.
    let box = root.getBoundingClientRect();
    let ball = measureBall(ballRef.current);
    const measure = () => {
      box = root.getBoundingClientRect();
      ball = measureBall(ballRef.current);
    };
    const aim = (clientX: number, clientY: number) => {
      if (!box.width || !box.height) return;
      lamp = {
        x: Math.min(1, Math.max(-1, ((clientX - box.left) / box.width) * 2 - 1)),
        y: Math.min(1, Math.max(-1, ((clientY - box.top) / box.height) * 2 - 1)),
      };
    };
    const point = (event: PointerEvent) => aim(event.clientX, event.clientY);
    // Touch events too: some mobile browsers stop sending pointermove once
    // they take a drag over for scrolling, while touchmove keeps coming.
    const touch = (event: TouchEvent) => {
      const finger = event.touches[0] ?? event.changedTouches[0];
      if (finger) aim(finger.clientX, finger.clientY);
    };
    // Passive and never prevented, so scrolling and taps are left alone;
    // captured, so a control that stops the event still lights the lamp.
    const listen = { passive: true, capture: true } as const;
    const events = [
      ["pointerdown", point],
      ["pointermove", point],
      ["touchstart", touch],
      ["touchmove", touch],
    ] as const;

    draw(performance.now());
    if (!still) {
      for (const [type, handler] of events) window.addEventListener(type, handler as EventListener, listen);
      frame = requestAnimationFrame(tick);
    }
    const resized = typeof ResizeObserver === "function"
      ? new ResizeObserver(() => {
          measure();
          draw(performance.now());
        })
      : null;
    resized?.observe(root);
    // The ball's own box resizes when a screen asks for the big one (Home).
    if (ballRef.current) resized?.observe(ballRef.current);

    return () => {
      cancelAnimationFrame(frame);
      for (const [type, handler] of events) window.removeEventListener(type, handler as EventListener, listen);
      resized?.disconnect();
      sequinCanvas?.removeEventListener("webglcontextlost", lost);
      sequins?.release();
      sequinCanvas?.remove();
    };
  }, [sparkle, reduced]);

  return (
    <div ref={rootRef} className="esc-stage" aria-hidden="true">
      {/* In Sparkle the effect puts the sequin canvas here, before the lights. */}
      <canvas ref={lightsRef} className="esc-stage-lights" />
      <div ref={ballRef} className="esc-stage-ball" />
    </div>
  );
};

export default Stage;
