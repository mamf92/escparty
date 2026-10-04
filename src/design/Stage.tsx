import { useEffect, useRef } from "react";
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

/** The ball's diameter for a stage this wide, in CSS pixels. */
const ballSize = (width: number) => Math.round(Math.min(200, Math.max(84, width * 0.24)));
/**
 * How far below the stage's top edge the ball hangs: under the app bar, so
 * it never crowds the brand or the Sparkle mode switch.
 */
const HANG = 56;
/** Frames a second while turning: enough for a slow ball. */
const FPS = 30;

const SEQUINS = `precision highp float;
uniform vec2 r; uniform float t; uniform vec2 m; uniform float s;
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
  gl_FragColor=vec4(pow(col,vec3(.95)),1.);
}`;

type Sequins = { draw: (time: number, lampX: number, lampY: number) => void };

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
  const program = gl.createProgram();
  const vertex = shader(gl.VERTEX_SHADER, "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}");
  const fragment = shader(gl.FRAGMENT_SHADER, SEQUINS);
  if (!program || !vertex || !fragment) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const a = gl.getAttribLocation(program, "a");
  gl.enableVertexAttribArray(a);
  gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
  const u = (name: string) => gl.getUniformLocation(program, name);
  const [ur, ut, um, us] = [u("r"), u("t"), u("m"), u("s")];

  return {
    draw: (time, lampX, lampY) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.round(canvas.clientWidth * dpr);
      const h = Math.round(canvas.clientHeight * dpr);
      if (!w || !h) return;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(ur, w, h);
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
const paintLights = (canvas: HTMLCanvasElement, sparkle: boolean, lampX: number, lampY: number, phase: number) => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
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
  const size = ballSize(width);
  const left = (width - size) / 2;
  const top = HANG;
  const centreY = top + size / 2;

  // The spots first, so the ball hangs in front of them.
  for (const spot of ballSpots(look, lamp, phase, centreY / height)) {
    const radius = (spot.size * size) / 2 + 2;
    const x = spot.x * width;
    const y = spot.y * height;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, rgba(spot.colour, spot.alpha));
    glow.addColorStop(0.6, rgba(spot.colour, spot.alpha * 0.7));
    glow.addColorStop(1, rgba(spot.colour, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // The wire it hangs from, then the ball, a facet at a time.
  ctx.fillStyle = sparkle ? "#f3e6ee" : "#b89aac";
  ctx.fillRect(width / 2 - 1, 0, 2, top + 2);
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

const prefersStill = () =>
  typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const Stage = () => {
  const { theme } = useDesignTheme();
  const sparkle = theme === "sparkle";
  const rootRef = useRef<HTMLDivElement>(null);
  const sequinsRef = useRef<HTMLCanvasElement>(null);
  const lightsRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const lights = lightsRef.current;
    if (!root || !lights) return;

    const still = !sparkle || prefersStill();
    const sequins = sparkle && sequinsRef.current ? sequinFloor(sequinsRef.current) : null;
    let lamp: { x: number; y: number } = RESTING_LIGHT;
    let phase = 0.4;
    let last = performance.now();
    let frame = 0;
    let drawn = 0;

    const draw = (now: number) => {
      sequins?.draw(still ? 0 : now / 1000, lamp.x, lamp.y);
      paintLights(lights, sparkle, lamp.x, lamp.y, phase);
    };

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (now - drawn < 1000 / FPS) return;
      phase = (phase + SPIN * ((now - last) / 1000) + Math.PI * 2) % (Math.PI * 2);
      last = now;
      drawn = now;
      draw(now);
    };

    // In Sparkle the pointer (or a finger) is the lamp.
    const point = (event: PointerEvent) => {
      const box = root.getBoundingClientRect();
      if (!box.width || !box.height) return;
      lamp = {
        x: Math.min(1, Math.max(-1, ((event.clientX - box.left) / box.width) * 2 - 1)),
        y: Math.min(1, Math.max(-1, ((event.clientY - box.top) / box.height) * 2 - 1)),
      };
    };

    draw(performance.now());
    if (!still) {
      window.addEventListener("pointermove", point, { passive: true });
      frame = requestAnimationFrame(tick);
    }
    const resized = typeof ResizeObserver === "function" ? new ResizeObserver(() => draw(performance.now())) : null;
    resized?.observe(root);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", point);
      resized?.disconnect();
    };
  }, [sparkle]);

  return (
    <div ref={rootRef} className="esc-stage" aria-hidden="true">
      {sparkle && <canvas ref={sequinsRef} className="esc-stage-sequins" />}
      <canvas ref={lightsRef} className="esc-stage-lights" />
    </div>
  );
};

export default Stage;
