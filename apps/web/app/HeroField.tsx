"use client";

import { useEffect, useRef } from "react";
import styles from "./hero-field.module.css";

const vertex = `attribute vec2 position; void main(){gl_Position=vec4(position,0.,1.);}`;
const fragment = `precision mediump float;
uniform vec2 resolution; uniform float time; uniform vec2 pointer;
float ring(vec2 p,float r,float w){return smoothstep(w,0.,abs(length(p)-r));}
void main(){
  vec2 uv=(gl_FragCoord.xy-.5*resolution.xy)/min(resolution.x,resolution.y);
  uv.x+=.10; uv.y-=.02;
  float drift=sin(time*.18)*.025;
  float r1=ring(uv+vec2(drift,0.),.39,.0022);
  float r2=ring(uv-vec2(drift*.7,.02),.235,.0017);
  float node=pow(max(0.,1.-length(uv-vec2(.23,.16))*9.),7.);
  float pulse=ring(uv-vec2(-.18,-.07),.12+sin(time*1.1)*.006,.0025);
  float glow=.055/(.025+abs(length(uv)-.39));
  vec3 mint=vec3(.82,1.,.38); vec3 red=vec3(.98,.31,.22);
  vec3 color=mint*(r1*.36+r2*.22+node*.8+glow*.05)+red*pulse*.8;
  float haze=exp(-length(uv-vec2(pointer.x*.06,pointer.y*.06)) * 2.6)*.055;
  color+=mint*haze;
  gl_FragColor=vec4(color,clamp(max(max(r1,r2),max(node,pulse))+.12+haze,0.,.72));
}`;

function shader(gl: WebGLRenderingContext, type: number, source: string) {
  const value = gl.createShader(type);
  if (!value) return null;
  gl.shaderSource(value, source); gl.compileShader(value);
  return gl.getShaderParameter(value, gl.COMPILE_STATUS) ? value : null;
}

export function HeroField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = canvasRef.current; const gl = canvas?.getContext("webgl", { alpha: true, antialias: false });
    if (!canvas || !gl) return;
    const vs = shader(gl, gl.VERTEX_SHADER, vertex); const fs = shader(gl, gl.FRAGMENT_SHADER, fragment);
    if (!vs || !fs) return;
    const program = gl.createProgram(); if (!program) return;
    gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    const buffer = gl.createBuffer(); if (!buffer) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "position"); const time = gl.getUniformLocation(program, "time");
    const resolution = gl.getUniformLocation(program, "resolution"); const pointerUniform = gl.getUniformLocation(program, "pointer");
    let pointer = { x: 0, y: 0 }; let frame = 0; let active = true;
    const resize = () => { const ratio = Math.min(window.devicePixelRatio || 1, 1.5); canvas.width = canvas.clientWidth * ratio; canvas.height = canvas.clientHeight * ratio; gl.viewport(0, 0, canvas.width, canvas.height); };
    const move = (event: PointerEvent) => { const rect = canvas.getBoundingClientRect(); pointer = { x: (event.clientX - rect.left) / rect.width * 2 - 1, y: 1 - (event.clientY - rect.top) / rect.height * 2 }; };
    const draw = (now: number) => { if (!active) return; gl.useProgram(program); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0); gl.uniform1f(time, now * .001); gl.uniform2f(resolution, canvas.width, canvas.height); gl.uniform2f(pointerUniform, pointer.x, pointer.y); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); frame = requestAnimationFrame(draw); };
    resize(); window.addEventListener("resize", resize); window.addEventListener("pointermove", move, { passive: true }); frame = requestAnimationFrame(draw);
    return () => { active = false; cancelAnimationFrame(frame); window.removeEventListener("resize", resize); window.removeEventListener("pointermove", move); gl.deleteProgram(program); gl.deleteBuffer(buffer); gl.deleteShader(vs); gl.deleteShader(fs); };
  }, []);
  return <canvas ref={canvasRef} className={styles.field} aria-hidden="true" />;
}
