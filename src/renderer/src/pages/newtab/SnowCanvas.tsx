import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

export interface SnowCanvasHandle {
  triggerSnowBurst: () => void;
}

interface SnowCanvasProps {
  snowAccumMode: string;
  isFocusMode: boolean;
  isPaused?: boolean;
}

interface Particle {
  x: number;
  y: number;
  baseY: number;
  r: number;
  opacity: number;
  life: number;
}

interface TrailParticle {
  x: number; y: number; r: number; vx: number; vy: number; life: number; decay: number;
  update: () => void;
  draw: () => void;
}

interface FlakeParticle {
  x: number; y: number; r: number; speed: number; wind: number; swing: number; phase: number; opacity: number;
  reset: (init: boolean) => void;
  update: () => void;
  tryAccumulate: (x: number, y: number) => void;
  draw: () => void;
}

export const SnowCanvas = forwardRef<SnowCanvasHandle, SnowCanvasProps>(({ snowAccumMode, isFocusMode, isPaused = false }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const accumRef = useRef<Particle[]>([]);
  const burstTimerRef = useRef(0);
  const burstIntensityRef = useRef(0);

  useImperativeHandle(ref, () => ({
    triggerSnowBurst: (): void => {
      const accum = accumRef.current;
      const count = accum.length;
      accum.length = 0;
      burstIntensityRef.current = Math.min(count / 2500, 1);
      burstTimerRef.current = 40 + Math.floor(burstIntensityRef.current * 80);
    }
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = 0;
    let H = 0;
    const FLAKE_COUNT = 180;
    const flakes: FlakeParticle[] = [];
    const trailFlakes: TrailParticle[] = [];
    const accum = accumRef.current;

    const getStageRect = (): DOMRect => {
      return (canvas.parentElement || canvas).getBoundingClientRect();
    };
    const stageEl = canvas.parentElement || canvas;

    const resize = (): void => {
      const rect = getStageRect();
      W = canvas.width = Math.max(1, Math.floor(rect.width));
      H = canvas.height = Math.max(1, Math.floor(rect.height));
      accum.length = 0;
      trailFlakes.length = 0;
    };
    window.addEventListener('resize', resize);
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(stageEl);
    window.visualViewport?.addEventListener('resize', resize);
    resize();

    class TrailFlake implements TrailParticle {
      x: number; y: number; r: number; vx: number; vy: number; life: number; decay: number;
      constructor(x: number, y: number) {
        this.x = x + (Math.random() - 0.5) * 12;
        this.y = y + (Math.random() - 0.5) * 12;
        this.r = Math.random() * 2.5 + 1;
        this.vx = (Math.random() - 0.5) * 1.5;
        this.vy = (Math.random() - 0.5) * 1.5;
        this.life = 1;
        this.decay = Math.random() * 0.015 + 0.015;
      }
      update(): void {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.04;
        this.life -= this.decay;
      }
      draw(): void {
        if(!ctx) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${this.life * 0.8})`;
        ctx.fill();
      }
    }

    class Flake implements FlakeParticle {
      x!: number; y!: number; r!: number; speed!: number; wind!: number; swing!: number; phase!: number; opacity!: number;
      constructor() { this.reset(true); }
      reset(init: boolean): void {
        this.x = Math.random() * W;
        this.y = init ? Math.random() * H * -1 : -10;
        this.r = Math.random() * 2.5 + 0.8;
        
        if (burstTimerRef.current > 0) {
          this.speed = Math.random() * (10 + burstIntensityRef.current * 15) + (5 + burstIntensityRef.current * 5);
          this.wind = (Math.random() - 0.5) * (15 + burstIntensityRef.current * 25);
        } else {
          this.speed = Math.random() * 1.2 + 0.4;
          this.wind = Math.random() * 0.6 - 0.3;
        }
        this.swing = Math.random() * 0.02 + 0.005;
        this.phase = Math.random() * Math.PI * 2;
        this.opacity = Math.random() * 0.6 + 0.3;
      }
      update(): void {
        this.phase += this.swing;
        this.x += Math.sin(this.phase) * 0.8 + this.wind;
        this.y += this.speed;
        
        if (burstTimerRef.current === 0) {
          if (this.y >= H - 60) {
            this.tryAccumulate(this.x, H - 60);
            this.reset(false);
            return;
          }
          const targets = accumTargets;
          for (const rect of targets) {
            if (this.x >= rect.left - 10 && this.x <= rect.right + 10 &&
                this.y >= rect.top - 3 && this.y <= rect.top + 3) {
              this.tryAccumulate(this.x, rect.top);
              this.reset(false);
              return;
            }
          }
        }
        if (this.x < -40 || this.x > W + 40 || this.y > H + 20) this.reset(false);
      }
      tryAccumulate(x: number, y: number): void {
        if (snowAccumMode === 'off') return;
        if (snowAccumMode === 'normal' && accum.length > 500) accum.shift();
        if (snowAccumMode === 'extreme' && accum.length > 10000) accum.shift();
        
        const chance = snowAccumMode === 'extreme' ? 0.85 : 0.3;
        if (Math.random() < chance) { 
          let stackY = y;
          const searchX = x + (Math.random() - 0.5) * 16; 
          for (let i = accum.length - 1; i >= Math.max(0, accum.length - 3000); i--) {
            if (accum[i].baseY === y && Math.abs(accum[i].x - searchX) < 10) {
              stackY = Math.min(stackY, accum[i].y - (Math.random() * 1.5 + 0.8));
            }
          }
          accum.push({
            x: searchX, y: stackY, baseY: y,
            r: this.r * (Math.random() * 0.8 + 1.2),
            opacity: Math.random() * 0.5 + 0.5,
            life: 1
          });
        }
      }
      draw(): void {
        if(!ctx) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${this.opacity})`;
        ctx.fill();
      }
    }

    let accumTargets: DOMRect[] = [];
    let targetTimer = 0;

    const updateTargets = (): void => {
      const rects: DOMRect[] = [];
      const stageRect = getStageRect();
      const toCanvasRect = (rect: DOMRect): DOMRect =>
        new DOMRect(rect.left - stageRect.left, rect.top - stageRect.top, rect.width, rect.height);
      const sb = document.getElementById('searchBarWrapper');
      if (sb) rects.push(toCanvasRect(sb.getBoundingClientRect()));
      
      if (!isFocusMode) {
        document.querySelectorAll('.nav-card').forEach(el => rects.push(toCanvasRect(el.getBoundingClientRect())));
        document.querySelectorAll('.card-link').forEach(el => rects.push(toCanvasRect(el.getBoundingClientRect())));
      }
      accumTargets = rects;
    };

    for (let i = 0; i < FLAKE_COUNT; i++) flakes.push(new Flake());

    const handleMouseMove = (e: MouseEvent): void => {
      if (!isPaused) {
        const rect = getStageRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
        for(let i=0; i<2; i++) trailFlakes.push(new TrailFlake(x, y));
      }
    };
    stageEl.addEventListener('mousemove', handleMouseMove);

    const handleClick = (e: MouseEvent): void => {
      const rect = getStageRect();
      const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
      if (cx < 0 || cy < 0 || cx > rect.width || cy > rect.height) return;

      const icon = document.createElement('div');
      icon.className = 'click-snowflake';
      icon.style.left = cx + 'px';
      icon.style.top = cy + 'px';
      canvas.parentElement?.appendChild(icon);
      setTimeout(() => icon.remove(), 900);

      const clearRadius = 60;
      for (let i = accum.length - 1; i >= 0; i--) {
        const dx = accum[i].x - cx, dy = accum[i].y - cy;
        if (dx * dx + dy * dy < clearRadius * clearRadius) {
          accum.splice(i, 1);
        }
      }
    };
    stageEl.addEventListener('click', handleClick);

    const draw = (): void => {
      ctx.clearRect(0, 0, W, H);
      targetTimer++;
      if (targetTimer % 30 === 0) updateTargets();
      
      if (burstTimerRef.current > 0) burstTimerRef.current--;

      if (!isPaused) {
        flakes.forEach(f => { f.update(); f.draw(); });
      } else {
        flakes.forEach(f => f.draw());
      }

      for (let i = trailFlakes.length - 1; i >= 0; i--) {
        const t = trailFlakes[i];
        t.update();
        if (t.life <= 0) trailFlakes.splice(i, 1);
        else t.draw();
      }

      const meltRate = snowAccumMode === 'extreme' ? 0.000015 : 0.0008;
      for (let i = accum.length - 1; i >= 0; i--) {
        const a = accum[i];
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${a.opacity * a.life})`;
        ctx.fill();
        a.life -= meltRate;
        if (a.life <= 0) accum.splice(i, 1);
      }

      animRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      window.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('resize', resize);
      resizeObserver.disconnect();
      stageEl.removeEventListener('mousemove', handleMouseMove);
      stageEl.removeEventListener('click', handleClick);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isFocusMode, snowAccumMode, isPaused]);

  return <canvas ref={canvasRef} className="snow-canvas" />;
});
