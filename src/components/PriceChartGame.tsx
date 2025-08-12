import React, { useEffect, useRef, useState } from 'react';
            
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
const BIRD_X = 85; // px from left
const GRAVITY = 1200; // px/s^2
const FLAP_VELOCITY = -200; // px/s
const BIRD_SIZE = 24; // sprite size in px
const SPAWN_INTERVAL_MS = 1000;
const OBSTACLE_WIDTH_PX = 14;
const MIN_GAP_FROM_LINE_PX = 60; // ensure bar bottom is at least this far from the line at spawn
const REVEAL_DURATION_MS = 280; // how long a new bar takes to fully reveal from the right

// Chart paddings
const LEFT_PAD = 56;
const RIGHT_PAD = 20;
const TOP_PAD = 20;
const BOTTOM_PAD = 20;

// Desired on-screen position for the latest price within the vertical range [0=bottom, 1=top]
const PRICE_POS_FRACTION = 0.7; // 40% from bottom

// Nice ticks helpers
const TARGET_TICK_COUNT = 5;
const MIN_ABS_STEP = 1e-6; // minimum absolute step between ticks to avoid tiny deltas

const niceNumber = (value: number, round: boolean): number => {
  // Returns a 'nice' number approximately equal to value.
  // Rounds the number if round = true, otherwise takes ceiling.
  if (value <= 0 || !isFinite(value)) return 0;
  const exponent = Math.floor(Math.log10(value));
  const fraction = value / Math.pow(10, exponent);
  let niceFraction: number;
  if (round) {
    if (fraction < 1.5) niceFraction = 1;
    else if (fraction < 3) niceFraction = 2;
    else if (fraction < 7) niceFraction = 5;
    else niceFraction = 10;
  } else {
    if (fraction <= 1) niceFraction = 1;
    else if (fraction <= 2) niceFraction = 2;
    else if (fraction <= 5) niceFraction = 5;
    else niceFraction = 10;
  }
  return niceFraction * Math.pow(10, exponent);
};

const snapHalfSpanToNice = (halfSpan: number): number => {
  const rawStep = (halfSpan * 2) / (TARGET_TICK_COUNT - 1);
  const step = Math.max(MIN_ABS_STEP, niceNumber(rawStep, true));
  return (step * (TARGET_TICK_COUNT - 1)) / 2;
};

const PriceChartGame: React.FC<PriceChartGameProps> = ({ price, feedKey }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const [series, setSeries] = useState<SamplePoint[]>([]);
  const [axisRange, setAxisRange] = useState<{ min: number; max: number } | null>(null);
  const startPriceRef = useRef<number | null>(null);
  const axisCenterRef = useRef<number | null>(null);
  const axisHalfSpanRef = useRef<number>(0);

  const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameover'>('idle');
  const [scoreSeconds, setScoreSeconds] = useState(0);
  const gameStartRef = useRef<number | null>(null);
  const idleStartRef = useRef<number | null>(performance.now());
  const gameOverAtRef = useRef<number | null>(null);

  type Obstacle = { spawnT: number; width: number; gapFromLinePx: number; initialHeight: number };
  const obstaclesRef = useRef<Obstacle[]>([]);
  const lastSpawnRef = useRef<number | null>(null);

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
    idleStartRef.current = performance.now();
    gameOverAtRef.current = null;
    birdYRef.current = 30;
    birdVYRef.current = 0;
    obstaclesRef.current = [];
    lastSpawnRef.current = null;
    // Axis related resets
    setAxisRange(null);
    startPriceRef.current = null;
    axisCenterRef.current = null;
    axisHalfSpanRef.current = 0;
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

  // Initialize axis based on first price; then smoothly recenters/expands to keep price near center
  useEffect(() => {
    if (price == null || Number.isNaN(price)) return;

    if (startPriceRef.current == null) {
      startPriceRef.current = price;
      const baseHalfSpan = Math.max(1e-9, Math.abs(price) * 0.001); // ~±0.1%
      const halfSpan = snapHalfSpanToNice(baseHalfSpan);
      // Center so that price appears at PRICE_POS_FRACTION within the range
      const center = price + (PRICE_POS_FRACTION - 0.5) * (2 * halfSpan);
      axisCenterRef.current = center;
      axisHalfSpanRef.current = halfSpan;
      setAxisRange({ min: center - halfSpan, max: center + halfSpan });
      return;
    }

    // Proactive recenter/resize
    let center = axisCenterRef.current ?? price;
    let halfSpan = axisHalfSpanRef.current || Math.max(1e-9, Math.abs(price) * 0.001);

    // Compute the target center that would place the price at PRICE_POS_FRACTION
    const targetCenter = price + (PRICE_POS_FRACTION - 0.5) * (2 * halfSpan);

    const lower = center - halfSpan;
    const upper = center + halfSpan;

    // Bounds in terms of distance from center
    const distance = price - center;
    const absDistance = Math.abs(distance);

    let nextCenter = center;
    let nextHalfSpan = halfSpan;

    // Define inner and outer bands as fractions of current half span
    const innerBand = 0.25 * halfSpan;   // within 25%: no change
    const midBand = 0.55 * halfSpan;     // within 55%: slight recenter
    const outerBand = 0.8 * halfSpan;    // beyond 80%: stronger recenter
    const edgeBand = 0.92 * halfSpan;    // near edge: expand span gradually

    if (absDistance > innerBand) {
      // Smoothly move center toward target placement (biasing to 40% from bottom)
      const desiredShift = targetCenter - center;
      const k = absDistance > outerBand ? 0.25 : absDistance > midBand ? 0.12 : 0.06; // smoothing factor
      nextCenter = center + k * desiredShift;
    }

    if (price < lower + (halfSpan * (1 - edgeBand / halfSpan)) || price > upper - (halfSpan * (1 - edgeBand / halfSpan))) {
      // Near edges: grow span slightly to add headroom
      nextHalfSpan = halfSpan * 1.02; // 2% growth
    }

    // Snap half-span to a nice step so tick values are reasonable
    nextHalfSpan = snapHalfSpanToNice(nextHalfSpan);

    // Update axis range if changed
    if (nextCenter !== center || nextHalfSpan !== halfSpan) {
      axisCenterRef.current = nextCenter;
      axisHalfSpanRef.current = nextHalfSpan;
      setAxisRange({ min: nextCenter - nextHalfSpan, max: nextCenter + nextHalfSpan });
    }
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
        // lock restart for 3 seconds after game over
        if (gameOverAtRef.current && performance.now() - gameOverAtRef.current < 1000) {
          return;
        }
        // restart
        setGameState('idle');
        setScoreSeconds(0);
        gameStartRef.current = null;
        birdYRef.current = 30;
        birdVYRef.current = 0;
        obstaclesRef.current = [];
        lastSpawnRef.current = null;
        gameOverAtRef.current = null;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gameState]);

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
    const x = ((clamped - leftT) / (rightT - leftT)) * (w - LEFT_PAD - RIGHT_PAD) + LEFT_PAD;
    return x;
  };

  const valueToY = (v: number, h: number, r: { min: number; max: number }) => {
    const top = TOP_PAD;
    const bottom = h - BOTTOM_PAD;
    const clamped = Math.max(r.min, Math.min(r.max, v));
    const y = bottom - ((clamped - r.min) / (r.max - r.min)) * (bottom - top);
    return y;
  };

  const getLineYAtX = (xPx: number, now: number, w: number, h: number, r: { min: number; max: number }): number | null => {
    if (series.length < 2) return null;
    // Convert x back to time
    const leftT = now - WINDOW_MS;
    const u = (xPx - LEFT_PAD) / (w - LEFT_PAD - RIGHT_PAD);
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

  // Tick helpers
  const computeTicks = (min: number, max: number, targetCount = 5): number[] => {
    if (!isFinite(min) || !isFinite(max)) return [];
    if (max <= min) return [min, max];
    const span = max - min;
    const step = span / (targetCount - 1);
    const ticks: number[] = [];
    for (let i = 0; i < targetCount; i++) ticks.push(min + step * i);
    return ticks;
  };

  const formatTick = (v: number): string => {
    const abs = Math.abs(v);
    let decimals = 2;
    if (abs < 1) decimals = 6;
    else if (abs < 10) decimals = 5;
    else if (abs < 100) decimals = 4;
    else if (abs < 1000) decimals = 3;
    return v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
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

      // Cleanup old obstacles (off-screen)
      obstaclesRef.current = obstaclesRef.current.filter(ob => {
        const xRight = timeToX(ob.spawnT, now, w);
        return xRight > LEFT_PAD; // remove once the bar's right edge reaches the left padding
      });

      const range = axisRange;

      // Draw y-axis grid and labels
      if (range) {
        const ticks = computeTicks(range.min, range.max, 5);
        ctx.save();
        const gridColor = getComputedStyle(document.documentElement).getPropertyValue('--border-primary') || 'rgba(255,255,255,0.1)';
        const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary') || '#cbd5e1';
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        ctx.font = `${12 * (window.devicePixelRatio || 1)}px ui-sans-serif, system-ui, -apple-system`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        for (const tVal of ticks) {
          const y = valueToY(tVal, h, range);
          // grid line
          ctx.beginPath();
          ctx.moveTo(LEFT_PAD, y);
          ctx.lineTo(w - RIGHT_PAD, y);
          ctx.stroke();
          // label
          ctx.fillStyle = textColor;
          const label = formatTick(tVal);
          ctx.fillText(label, 6 * (window.devicePixelRatio || 1), y);
        }
        // y-axis line
        ctx.beginPath();
        ctx.moveTo(LEFT_PAD, TOP_PAD);
        ctx.lineTo(LEFT_PAD, h - BOTTOM_PAD);
        ctx.stroke();
        ctx.restore();
      }

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

      // Spawn obstacles after 8s of play, at fixed intervals
      if (gameState === 'playing' && gameStartRef.current != null) {
        const elapsedMs = performance.now() - gameStartRef.current;
        if (elapsedMs >= 5000) {
          const canSpawn = !lastSpawnRef.current || (performance.now() - lastSpawnRef.current >= SPAWN_INTERVAL_MS);
          if (canSpawn && range) {
            // Determine safe height based on the line Y at right edge
            const xRight = w - RIGHT_PAD - 1; // inside padding
            const lineY = getLineYAtX(xRight, now, w, h, range);
            if (lineY != null) {
              const minHeight = 20;
              const maxHeight = Math.max(minHeight, lineY - MIN_GAP_FROM_LINE_PX);
              if (maxHeight > minHeight) {
                const height = minHeight + Math.random() * (maxHeight - minHeight);
                const gapFromLinePx = lineY - height; // keep this gap constant as axis shifts
                obstaclesRef.current.push({ spawnT: now, width: OBSTACLE_WIDTH_PX * (window.devicePixelRatio || 1), gapFromLinePx, initialHeight: height });
                lastSpawnRef.current = performance.now();
              }
            }
          }
        }
      }

      // Draw obstacles (top red bars)
      if (obstaclesRef.current.length) {
        ctx.save();
        ctx.fillStyle = '#ef4444';
        ctx.shadowColor = 'rgba(239, 68, 68, 0.4)';
        ctx.shadowBlur = 6;
        for (const ob of obstaclesRef.current) {
          const xRight = timeToX(ob.spawnT, now, w);
          // Smooth width reveal from the right edge
          const reveal = Math.max(0, Math.min(1, (now - ob.spawnT) / REVEAL_DURATION_MS));
          const easedReveal = 1 - Math.pow(1 - reveal, 3); // easeOutCubic
          const effectiveWidth = ob.width * easedReveal;
          const xLeft = xRight - effectiveWidth;

          let height = ob.initialHeight;
          if (range) {
            const lineYNow = getLineYAtX(xRight, now, w, h, range);
            if (lineYNow != null) {
              height = Math.max(20, Math.min(h, lineYNow - ob.gapFromLinePx));
            }
          }
          ctx.fillRect(xLeft, 0, effectiveWidth, height);
        }
        ctx.restore();
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
          if (gameOverAtRef.current == null) gameOverAtRef.current = performance.now();
          setGameState('gameover');
        }

        // Collision with price line
        if (range) {
          const lineY = getLineYAtX(BIRD_X * (window.devicePixelRatio || 1), now, w, h, range);
          if (lineY != null) {
            const birdCenterY = currentBirdY * (window.devicePixelRatio || 1);
            const threshold = (BIRD_SIZE / 2) * (window.devicePixelRatio || 1);
            if (Math.abs(birdCenterY - lineY) <= threshold) {
              if (gameOverAtRef.current == null) gameOverAtRef.current = performance.now();
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
        const scoreText = `Score: ${Math.floor(scoreSeconds)}`;
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
        ctx.fillText(`Score: ${Math.floor(scoreSeconds)}`, centerX, centerY + 6 * dpr);

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
  }, [series, axisRange, gameState, scoreSeconds]);

  return (
    <div ref={containerRef} style={{ width: '100%', maxWidth: 600, margin: '1rem auto 0', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border-primary)', boxShadow: 'var(--shadow-lg)', background: 'var(--bg-glass)' }}>
      <canvas ref={canvasRef} />
    </div>
  );
};

export default PriceChartGame; 