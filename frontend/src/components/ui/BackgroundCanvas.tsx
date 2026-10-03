'use client';

/**
 * 全站背景動畫（零依賴 canvas 實作）
 *
 * 原以 p5 + @p5-wrapper/react 繪製 flow-field；p5 打包內含 core-js regenerator，
 * 在嚴格 CSP（無 'unsafe-eval'）下會執行 `Function("r","regeneratorRuntime = r")`
 * 而拋出未捕捉的 EvalError。改用原生 canvas 重寫同一視覺概念（主題色流場粒子），
 * 同時移除約 1MB 依賴、且不需要 'unsafe-eval'。
 *
 * 尊重 prefers-reduced-motion：不播放；分頁隱藏時暫停。
 */

import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  px: number;
  py: number;
}

const FIELD_SCALE = 40; // 流場格距（px）
const NOISE_STEP = 0.1; // 空間頻率
const Z_SPEED = 0.35; // 時間演化速度（度/秒）
const FORCE_MAG = 0.5;
const MAX_SPEED = 1.5;

/** 平順的偽 noise：少數正弦疊加，足夠做出有機流場且無外部依賴 */
function fieldAngle(x: number, y: number, t: number): number {
  const a = Math.sin(x * NOISE_STEP + t) + Math.cos(y * NOISE_STEP + t * 1.3);
  const b = Math.sin((x + y) * NOISE_STEP * 0.5 - t * 0.7);
  return (a + b) * Math.PI;
}

const BackgroundCanvas = () => {
  const { theme } = useTheme();
  const [enabled, setEnabled] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 尊重 reduced-motion；hydration 後才決定，避免 SSR 不一致
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setEnabled(!mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const isDark = theme === 'dark';
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let cols = 0;
    let rows = 0;
    let particles: Particle[] = [];
    let raf = 0;
    let last = 0;
    let time = 0;

    const newParticle = (): Particle => {
      const x = Math.random() * width;
      const y = Math.random() * height;
      return { x, y, vx: 0, vy: 0, px: x, py: y };
    };

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(width / FIELD_SCALE) + 2;
      rows = Math.ceil(height / FIELD_SCALE) + 2;
      const count = width < 768 ? 100 : 300;
      particles = Array.from({ length: count }, newParticle);
      ctx.clearRect(0, 0, width, height);
    };

    const step = (dt: number) => {
      time += Z_SPEED * dt;

      // 淡化上一幀，留下殘影（等同原 p5 的 background 透明度）
      ctx.fillStyle = isDark ? 'rgba(13, 17, 23, 0.08)' : 'rgba(242, 240, 233, 0.16)';
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = isDark
        ? 'rgba(212, 175, 55, 0.39)'
        : 'rgba(143, 166, 145, 0.39)';
      ctx.lineWidth = 1;
      ctx.beginPath();

      for (const p of particles) {
        const gx = Math.floor(p.x / FIELD_SCALE);
        const gy = Math.floor(p.y / FIELD_SCALE);
        const angle = fieldAngle(gx, gy, time);

        p.vx += Math.cos(angle) * FORCE_MAG;
        p.vy += Math.sin(angle) * FORCE_MAG;
        const speed = Math.hypot(p.vx, p.vy);
        if (speed > MAX_SPEED) {
          p.vx = (p.vx / speed) * MAX_SPEED;
          p.vy = (p.vy / speed) * MAX_SPEED;
        }
        p.x += p.vx;
        p.y += p.vy;

        // 邊界環繞
        if (p.x > width) p.x = 0;
        else if (p.x < 0) p.x = width;
        if (p.y > height) p.y = 0;
        else if (p.y < 0) p.y = height;

        ctx.moveTo(p.px, p.py);
        ctx.lineTo(p.x, p.y);
        p.px = p.x;
        p.py = p.y;
      }
      ctx.stroke();
    };

    const loop = (now: number) => {
      if (!raf) return; // 已暫停
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      step(dt);
      raf = requestAnimationFrame(loop);
    };

    const start = () => {
      if (raf) return;
      last = 0;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    const onVisibility = () => (document.hidden ? stop() : start());

    resize();
    start();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled, theme]);

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0"
      style={{ zIndex: -1 }}
    />
  );
};

export default BackgroundCanvas;
