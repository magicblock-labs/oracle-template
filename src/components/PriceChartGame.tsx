import React, { useEffect, useMemo, useRef, useState } from 'react';

interface PriceChartGameProps {
  price: number | null; // normalized/display price (already adjusted for exponent)
  feedKey: string | null; // changes when feed changes to reset internal state
}

interface SamplePoint {
  t: number; // ms timestamp
  v: number; // price value
}

const WINDOW_MS = 5000; // show last 30s of data
const MAX_POINTS = 600; // cap stored points

// Game constants
const BIRD_X = 35; // px from left
const GRAVITY = 1200; // px/s^2
const FLAP_VELOCITY = -200; // px/s
const BIRD_SIZE = 28; // sprite size in px

const PriceChartGame: React.FC<PriceChartGameProps> = ({ price, feedKey }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const [series, setSeries] = useState<SamplePoint[]>([]);
  const lastRangeRef = useRef<{ min: number; max: number } | null>(null);

  const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameover'>('idle');
  const [scoreSeconds, setScoreSeconds] = useState(0);
  const gameStartRef = useRef<number | null>(null);
  const idleStartRef = useRef<number | null>(performance.now());

  const birdYRef = useRef<number>(30);
  const birdVYRef = useRef<number>(0);

  const logoImgRef = useRef<HTMLImageElement | null>(null);
  const logoLoadedRef = useRef<boolean>(false);

  // Load logo image once
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      logoLoadedRef.current = true;
      logoImgRef.current = img;
    };
    img.src = '/logo.ico';
  }, []);

  // Reset state when feed changes
  useEffect(() => {
    setSeries([]);
    setGameState('idle');
    setScoreSeconds(0);
    gameStartRef.current = null;
    birdYRef.current = 30;
    birdVYRef.current = 0;
    lastRangeRef.current = null;
  }, [feedKey]);

  // Collect time series on price updates
  useEffect(() => {
    if (price == null || Number.isNaN(price)) return;
    setSeries(prev => {
      const now = Date.now();
      const next = [...prev, { t: now, v: price }];
      // Trim to last WINDOW_MS and cap length
      const minT = now - WINDOW_MS * 2; // keep extra for interpolation
      let trimmed = next.filter(p => p.t >= minT);
      if (trimmed.length > MAX_POINTS) trimmed = trimmed.slice(trimmed.length - MAX_POINTS);
      return trimmed;
    });
  }, [price]);

  // Resize canvas to container
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = container.clientWidth;
      const height = Math.max(180, Math.floor(container.clientWidth * 0.4));
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
    };

    resize();

    if (!resizeObserverRef.current) {
      resizeObserverRef.current = new ResizeObserver(resize);
    }
    resizeObserverRef.current.observe(container);

    return () => {
      resizeObserverRef.current && resizeObserverRef.current.disconnect();
    };
  }, []);

  // Track when idle started for marquee timing
  useEffect(() => {
    if (gameState === 'idle') {
      idleStartRef.current = performance.now();
    }
  }, [gameState]);

  // Key controls (Space)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      e.preventDefault();
      if (gameState === 'idle') {
        setGameState('playing');
        gameStartRef.current = performance.now();
        birdVYRef.current = 0;
      } else if (gameState === 'playing') {
        birdVYRef.current = FLAP_VELOCITY;
      } else if (gameState === 'gameover') {
        // restart
        setGameState('idle');
        setScoreSeconds(0);
        gameStartRef.current = null;
        birdYRef.current = 30;
        birdVYRef.current = 0;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gameState]);

  // Compute y-range based on current price ±5%
  const range = useMemo(() => {
    if (price == null || Number.isNaN(price)) return lastRangeRef.current || null;
    const min = price * 0.9995;
    const max = price * 1.001;
    const r = { min, max };
    lastRangeRef.current = r;
    return r;
  }, [price]);

  // Helpers to map data to canvas coordinates
  const getContextAndSize = (): { ctx: CanvasRenderingContext2D; w: number; h: number; dpr: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width;
    const h = canvas.height;
    return { ctx, w, h, dpr };
  };

  const timeToX = (t: number, now: number, w: number) => {
    const leftT = now - WINDOW_MS;
    const rightT = now;
    const clamped = Math.max(leftT, Math.min(rightT, t));
    const x = ((clamped - leftT) / (rightT - leftT)) * (w - 40) + 20; // padding 20
    return x;
  };

  const valueToY = (v: number, h: number, r: { min: number; max: number }) => {
    const top = 20;
    const bottom = h - 20;
    const clamped = Math.max(r.min, Math.min(r.max, v));
    const y = bottom - ((clamped - r.min) / (r.max - r.min)) * (bottom - top);
    return y;
  };

  const getLineYAtX = (xPx: number, now: number, w: number, h: number, r: { min: number; max: number }): number | null => {
    if (series.length < 2) return null;
    // Convert x back to time
    const leftT = now - WINDOW_MS;
    const u = (xPx - 20) / (w - 40);
    const t = leftT + u * WINDOW_MS;

    // Find surrounding points
    let i = series.findIndex(p => p.t >= t);
    if (i <= 0) i = 1;
    if (i === -1) i = series.length - 1;
    const p0 = series[i - 1];
    const p1 = series[i] || p0;
    const frac = p1.t === p0.t ? 0 : (t - p0.t) / (p1.t - p0.t);
    const v = p0.v + frac * (p1.v - p0.v);
    return valueToY(v, h, r);
  };

  // Main draw loop
  useEffect(() => {
    let rafId = 0;
    let lastFrameTs = performance.now();

    const frame = () => {
      const env = getContextAndSize();
      if (!env) {
        rafId = requestAnimationFrame(frame);
        return;
      }
      const { ctx, w, h } = env;

      // Clear
      ctx.clearRect(0, 0, w, h);

      // Background card look
      ctx.save();
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-glass') || 'rgba(17,24,39,0.5)';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();

      // Draw border
      ctx.save();
      ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--border-primary') || 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 2;
      ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
      ctx.restore();

      const now = Date.now();

      // Draw price line
      if (range && series.length > 0) {
        const visible = series.filter(p => p.t >= now - WINDOW_MS);
        if (visible.length > 0) {
          ctx.save();
          ctx.lineWidth = 2;
          ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent-gold') || '#fbbf24';
          ctx.beginPath();
          for (let i = 0; i < visible.length; i++) {
            const p = visible[i];
            const x = timeToX(p.t, now, w);
            const y = valueToY(p.v, h, range);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
          ctx.restore();
        }
      }

      // Draw logo / bird
      const logo = logoImgRef.current;
      const showLogo = logo && logoLoadedRef.current;

      let currentBirdY = birdYRef.current;

      // Physics update
      const nowPerf = performance.now();
      const dt = Math.min(0.05, (nowPerf - lastFrameTs) / 1000); // cap dt
      lastFrameTs = nowPerf;

      if (gameState === 'playing') {
        birdVYRef.current += GRAVITY * dt;
        birdYRef.current += birdVYRef.current * dt;
        currentBirdY = birdYRef.current;

        // Update score
        if (gameStartRef.current != null) {
          const secs = (nowPerf - gameStartRef.current) / 1000;
          setScoreSeconds(secs);
        }

        // Collision with bounds
        const topBound = 10 + BIRD_SIZE / 2;
        const bottomBound = h - 10 - BIRD_SIZE / 2;
        // Do not lose on top hit; clamp instead
        if (currentBirdY < topBound) {
          birdYRef.current = topBound;
          birdVYRef.current = 0;
        }
        if (currentBirdY > bottomBound) {
          setGameState('gameover');
        }

        // Collision with price line
        if (range) {
          const lineY = getLineYAtX(BIRD_X * (window.devicePixelRatio || 1), now, w, h, range);
          if (lineY != null) {
            const birdCenterY = currentBirdY * (window.devicePixelRatio || 1);
            const threshold = (BIRD_SIZE / 2) * (window.devicePixelRatio || 1);
            if (Math.abs(birdCenterY - lineY) <= threshold) {
              setGameState('gameover');
            }
          }
        }
      }

      // Draw the bird/logo
      if (showLogo) {
        ctx.save();
        const dpr = window.devicePixelRatio || 1;
        const drawX = BIRD_X * dpr - BIRD_SIZE * dpr * 0.5;
        const drawY = (gameState === 'idle' ? 20 : currentBirdY * dpr - BIRD_SIZE * dpr * 0.5);
        const size = BIRD_SIZE * dpr;
        ctx.drawImage(logo as CanvasImageSource, drawX, drawY, size, size);
        ctx.restore();
      }

      // UI overlays
      ctx.save();
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary') || '#cbd5e1';
      ctx.font = `${14 * (window.devicePixelRatio || 1)}px ui-sans-serif, system-ui, -apple-system`;
      ctx.textBaseline = 'top';

      if (gameState === 'idle') {
        // After 5 seconds in idle, scroll the prompt across the top
        const dpr = window.devicePixelRatio || 1;
        const idleStart = idleStartRef.current;
        if (idleStart != null) {
          const nowPerf = performance.now();
          const elapsed = nowPerf - idleStart;
          if (elapsed >= 5000) {
            const scrollElapsed = elapsed - 5000; // ms
            const speedPxPerSec = 120; // CSS px per second
            const x = w - (scrollElapsed / 1000) * speedPxPerSec * dpr;
            const y = 8 * dpr;
            const text = '✨ press space to start ✨';
            ctx.save();
            ctx.font = `${16 * dpr}px ui-sans-serif, system-ui, -apple-system`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillStyle = '#e5e7eb';
            ctx.fillText(text, x, y);
            ctx.restore();
          }
        }
      } else if (gameState === 'playing') {
        const scoreText = `Score: ${Math.floor(scoreSeconds)}s`;
        const dpr = window.devicePixelRatio || 1;
        ctx.fillText(scoreText, (w - 120 * dpr), 16 * dpr);
      } else if (gameState === 'gameover') {
        const dpr = window.devicePixelRatio || 1;
        // Dark transparent overlay
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, w, h);
        ctx.restore();

        // Centered game over panel text
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const centerX = w / 2;
        const centerY = h / 2;

        ctx.fillStyle = '#ffffff';
        ctx.font = `${28 * dpr}px ui-sans-serif, system-ui, -apple-system`;
        ctx.fillText('Game Over', centerX, centerY - 20 * dpr);

        ctx.font = `${20 * dpr}px ui-sans-serif, system-ui, -apple-system`;
        ctx.fillText(`Score: ${Math.floor(scoreSeconds)}s`, centerX, centerY + 6 * dpr);

        ctx.font = `${16 * dpr}px ui-sans-serif, system-ui, -apple-system`;
        ctx.fillStyle = '#e5e7eb';
        ctx.fillText('Press Space to play again', centerX, centerY + 30 * dpr);
        ctx.restore();
      }
      ctx.restore();

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [series, range, gameState, scoreSeconds]);

  return (
    <div ref={containerRef} style={{ width: '100%', maxWidth: 600, margin: '1rem auto 0', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border-primary)', boxShadow: 'var(--shadow-lg)', background: 'var(--bg-glass)' }}>
      <canvas ref={canvasRef} />
    </div>
  );
};

export default PriceChartGame; 