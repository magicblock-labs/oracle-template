import React, { useEffect, useRef, useState } from 'react';

interface PriceChartGameProps {
  price: number | null;
  feedKey: string | null;
}

interface SamplePoint {
  t: number;
  v: number;
}

interface AxisRange {
  min: number;
  max: number;
}

interface DrawPoint {
  x: number;
  y: number;
}

type GameState = 'idle' | 'playing' | 'gameover';
type Obstacle = { spawnT: number; width: number; gapFromLinePx: number; initialHeight: number };

const WINDOW_MS = 15000;
const RENDER_DELAY_MS = 350;
const MAX_POINTS = 1200;

const BIRD_X = 85;
const GRAVITY = 1200;
const FLAP_VELOCITY = -200;
const BIRD_SIZE = 24;
const SPAWN_DELAY_MS = 5000;
const SPAWN_INTERVAL_MS = 1000;
const OBSTACLE_WIDTH_PX = 14;
const MIN_GAP_FROM_LINE_PX = 60;
const REVEAL_DURATION_MS = 500;

const LEFT_PAD = 76;
const RIGHT_PAD = 20;
const TOP_PAD = 20;
const BOTTOM_PAD = 24;
const PRICE_POS_FRACTION = 0.65;
const CURRENT_MARKER_RIGHT_OFFSET = 44;
const TIME_GRID_INTERVAL_MS = 5000;

const TARGET_TICK_COUNT = 5;
const MIN_FULL_SPAN = 1e-6;
const AXIS_EASE_PER_SECOND = 4;
const MAX_INTERPOLATION_GAP_MS = 220;
const SAMPLE_SMOOTHING_FACTOR = 0.22;
const CURVE_TENSION = 0.18;

const niceNumber = (value: number, round: boolean): number => {
  if (value <= 0 || !Number.isFinite(value)) return 0;

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

const formatTick = (value: number): string => {
  const absValue = Math.abs(value);
  let maximumFractionDigits = 2;

  if (absValue < 0.0001) maximumFractionDigits = 10;
  else if (absValue < 0.01) maximumFractionDigits = 8;
  else if (absValue < 1) maximumFractionDigits = 6;
  else if (absValue < 100) maximumFractionDigits = 4;

  return value.toLocaleString('en-US', {
    minimumFractionDigits: Math.min(2, maximumFractionDigits),
    maximumFractionDigits,
  });
};

const computeTicks = (min: number, max: number, targetCount = TARGET_TICK_COUNT): number[] => {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [];

  const step = niceNumber((max - min) / Math.max(1, targetCount - 1), true);
  if (step <= 0) return [];

  const ticks: number[] = [];
  const first = Math.ceil(min / step) * step;

  for (let value = first; value <= max + step * 0.5; value += step) {
    if (value >= min - step * 0.5) ticks.push(Number(value.toPrecision(12)));
    if (ticks.length > targetCount + 2) break;
  }

  return ticks.length ? ticks : [min, max];
};

const lerp = (from: number, to: number, amount: number): number => {
  return from + (to - from) * amount;
};

const PriceChartGame: React.FC<PriceChartGameProps> = ({ price, feedKey }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const seriesRef = useRef<SamplePoint[]>([]);
  const currentAxisRef = useRef<AxisRange | null>(null);
  const targetAxisRef = useRef<AxisRange | null>(null);
  const lastPriceRef = useRef<number | null>(null);

  const [gameState, setGameState] = useState<GameState>('idle');
  const gameStartRef = useRef<number | null>(null);
  const idleStartRef = useRef<number | null>(performance.now());
  const gameOverAtRef = useRef<number | null>(null);
  const scoreSecondsRef = useRef(0);

  const obstaclesRef = useRef<Obstacle[]>([]);
  const lastSpawnRef = useRef<number | null>(null);
  const birdYRef = useRef(30);
  const birdVYRef = useRef(0);

  const logoImgRef = useRef<HTMLImageElement | null>(null);
  const logoLoadedRef = useRef(false);

  const buildTargetAxis = (latestPrice: number, now: number): AxisRange => {
    const visible = seriesRef.current.filter((point) => point.t >= now - WINDOW_MS && point.t <= now);
    const values = visible.length ? visible.map((point) => point.v) : [latestPrice];
    const minValue = Math.min(latestPrice, ...values);
    const maxValue = Math.max(latestPrice, ...values);

    const minimumSpan = Math.max(Math.abs(latestPrice) * 0.002, MIN_FULL_SPAN);
    const belowSpan = (latestPrice - minValue) / PRICE_POS_FRACTION;
    const aboveSpan = (maxValue - latestPrice) / (1 - PRICE_POS_FRACTION);
    const fullSpan = Math.max(minimumSpan, belowSpan, aboveSpan);

    return {
      min: latestPrice - PRICE_POS_FRACTION * fullSpan,
      max: latestPrice + (1 - PRICE_POS_FRACTION) * fullSpan,
    };
  };

  const pushPriceSample = (nextPrice: number) => {
    const now = Date.now();
    const series = seriesRef.current;
    const previous = series[series.length - 1];

    if (previous && now - previous.t > MAX_INTERPOLATION_GAP_MS) {
      series.push({ t: now - MAX_INTERPOLATION_GAP_MS, v: previous.v });
    }

    const latestStored = series[series.length - 1];
    const chartValue = latestStored
      ? lerp(latestStored.v, nextPrice, SAMPLE_SMOOTHING_FACTOR)
      : nextPrice;

    if (!latestStored || Math.abs(latestStored.v - chartValue) > Number.EPSILON) {
      series.push({ t: now, v: chartValue });
    }

    const oldestVisible = now - WINDOW_MS * 3;
    while (series.length > 2 && series[0].t < oldestVisible) series.shift();
    if (series.length > MAX_POINTS) {
      series.splice(0, series.length - MAX_POINTS);
    }

    lastPriceRef.current = chartValue;
    const targetAxis = buildTargetAxis(chartValue, now);
    targetAxisRef.current = targetAxis;
    if (!currentAxisRef.current) currentAxisRef.current = targetAxis;
  };

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      logoLoadedRef.current = true;
      logoImgRef.current = img;
    };
    img.src = '/logo.ico';
  }, []);

  useEffect(() => {
    seriesRef.current = [];
    currentAxisRef.current = null;
    targetAxisRef.current = null;
    lastPriceRef.current = null;
    setGameState('idle');
    scoreSecondsRef.current = 0;
    gameStartRef.current = null;
    idleStartRef.current = performance.now();
    gameOverAtRef.current = null;
    birdYRef.current = 30;
    birdVYRef.current = 0;
    obstaclesRef.current = [];
    lastSpawnRef.current = null;
  }, [feedKey]);

  useEffect(() => {
    if (price == null || !Number.isFinite(price)) return;
    pushPriceSample(price);
  }, [price]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = container.clientWidth;
      const height = Math.min(280, Math.max(190, Math.floor(width * 0.42)));

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };

    resize();

    if (!resizeObserverRef.current) {
      resizeObserverRef.current = new ResizeObserver(resize);
    }
    resizeObserverRef.current.observe(container);

    return () => {
      resizeObserverRef.current?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (gameState === 'idle') {
      idleStartRef.current = performance.now();
    }
  }, [gameState]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;

      event.preventDefault();

      if (gameState === 'idle') {
        setGameState('playing');
        scoreSecondsRef.current = 0;
        gameStartRef.current = performance.now();
        birdVYRef.current = 0;
      } else if (gameState === 'playing') {
        birdVYRef.current = FLAP_VELOCITY;
      } else if (gameState === 'gameover') {
        if (gameOverAtRef.current && performance.now() - gameOverAtRef.current < 500) return;

        setGameState('idle');
        scoreSecondsRef.current = 0;
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

  const getContextAndSize = (): { ctx: CanvasRenderingContext2D; w: number; h: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const dpr = window.devicePixelRatio || 1;
    const bounds = canvas.getBoundingClientRect();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    return { ctx, w: bounds.width, h: bounds.height };
  };

  const timeToX = (timestamp: number, visualNow: number, width: number): number => {
    const leftTime = visualNow - WINDOW_MS;
    const plotRight = getPlotRight(width);
    const plotWidth = plotRight - LEFT_PAD;
    return LEFT_PAD + ((timestamp - leftTime) / WINDOW_MS) * plotWidth;
  };

  const xToTime = (x: number, visualNow: number, width: number): number => {
    const leftTime = visualNow - WINDOW_MS;
    const plotRight = getPlotRight(width);
    const plotWidth = plotRight - LEFT_PAD;
    const progress = (x - LEFT_PAD) / plotWidth;
    return leftTime + progress * WINDOW_MS;
  };

  const getPlotRight = (width: number): number => {
    return Math.max(LEFT_PAD + 1, width - RIGHT_PAD - CURRENT_MARKER_RIGHT_OFFSET);
  };

  const valueToY = (value: number, height: number, range: AxisRange): number => {
    if (range.max <= range.min) return height / 2;

    const top = TOP_PAD;
    const bottom = height - BOTTOM_PAD;
    const clamped = Math.max(range.min, Math.min(range.max, value));

    return bottom - ((clamped - range.min) / (range.max - range.min)) * (bottom - top);
  };

  const interpolateValueAt = (timestamp: number): number | null => {
    const series = seriesRef.current;
    if (!series.length) return null;
    if (series.length === 1 || timestamp <= series[0].t) return series[0].v;

    const last = series[series.length - 1];
    if (timestamp >= last.t) return last.v;

    let low = 0;
    let high = series.length - 1;

    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (series[mid].t < timestamp) low = mid + 1;
      else high = mid;
    }

    const current = series[low];
    const previous = series[Math.max(0, low - 1)];
    const duration = current.t - previous.t;
    const amount = duration <= 0 ? 1 : (timestamp - previous.t) / duration;

    return lerp(previous.v, current.v, amount);
  };

  const getLineYAtX = (
    x: number,
    visualNow: number,
    width: number,
    height: number,
    range: AxisRange,
  ): number | null => {
    const value = interpolateValueAt(xToTime(x, visualNow, width));
    return value == null ? null : valueToY(value, height, range);
  };

  const buildLinePoints = (visualNow: number, width: number, height: number, range: AxisRange): DrawPoint[] => {
    const series = seriesRef.current;
    if (!series.length) return [];

    const leftTime = visualNow - WINDOW_MS;
    const right = getPlotRight(width);
    const points: DrawPoint[] = [];
    const firstVisibleIndex = series.findIndex((point) => point.t >= leftTime);

    if (firstVisibleIndex > 0) {
      const leftValue = interpolateValueAt(leftTime);
      if (leftValue != null) points.push({ x: LEFT_PAD, y: valueToY(leftValue, height, range) });
    }

    const visibleStart = firstVisibleIndex === -1 ? Math.max(0, series.length - 1) : firstVisibleIndex;

    for (let index = visibleStart; index < series.length; index += 1) {
      const point = series[index];
      if (point.t > visualNow) break;

      const x = timeToX(point.t, visualNow, width);
      if (x >= LEFT_PAD && x <= right) {
        points.push({ x, y: valueToY(point.v, height, range) });
      }
    }

    const latestVisiblePrice = interpolateValueAt(visualNow);
    if (latestVisiblePrice != null) {
      const latestPoint = { x: right, y: valueToY(latestVisiblePrice, height, range) };
      const previousPoint = points[points.length - 1];

      if (!previousPoint || Math.abs(previousPoint.x - latestPoint.x) > 1) {
        points.push(latestPoint);
      } else {
        points[points.length - 1] = latestPoint;
      }
    }

    return points;
  };

  const drawStablePath = (ctx: CanvasRenderingContext2D, points: DrawPoint[]) => {
    if (!points.length) return;

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    if (points.length === 1) {
      ctx.lineTo(points[0].x + 1, points[0].y);
      return;
    }

    if (points.length === 2) {
      ctx.lineTo(points[1].x, points[1].y);
      return;
    }

    for (let index = 0; index < points.length - 1; index += 1) {
      const previous = points[Math.max(0, index - 1)];
      const current = points[index];
      const next = points[index + 1];
      const following = points[Math.min(points.length - 1, index + 2)];

      const cp1x = current.x + (next.x - previous.x) * CURVE_TENSION;
      const cp1y = current.y + (next.y - previous.y) * CURVE_TENSION;
      const cp2x = next.x - (following.x - current.x) * CURVE_TENSION;
      const cp2y = next.y - (following.y - current.y) * CURVE_TENSION;

      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, next.x, next.y);
    }
  };

  const drawTimeGrid = (
    ctx: CanvasRenderingContext2D,
    visualNow: number,
    width: number,
    height: number,
    color: string,
  ) => {
    const leftTime = visualNow - WINDOW_MS;
    const firstGridTime = Math.floor(leftTime / TIME_GRID_INTERVAL_MS) * TIME_GRID_INTERVAL_MS;
    const chartRight = width - RIGHT_PAD;
    const top = TOP_PAD;
    const bottom = height - BOTTOM_PAD;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;

    for (
      let timestamp = firstGridTime;
      timestamp <= visualNow + TIME_GRID_INTERVAL_MS;
      timestamp += TIME_GRID_INTERVAL_MS
    ) {
      const x = timeToX(timestamp, visualNow, width);
      if (x < LEFT_PAD || x > chartRight) continue;

      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();
    }

    ctx.restore();
  };

  const drawCurrentMarker = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string,
    nowPerf: number,
  ) => {
    const pulse = (Math.sin(nowPerf / 280) + 1) / 2;
    const coreRadius = 5 + pulse * 0.5;
    const haloRadius = 8 + pulse * 4;

    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 12 + pulse * 4;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, coreRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, coreRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.16 - pulse * 0.05;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(x, y, haloRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };

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
      const now = Date.now();
      const visualNow = now - RENDER_DELAY_MS;
      const nowPerf = performance.now();
      const dt = Math.min(0.05, (nowPerf - lastFrameTs) / 1000);
      lastFrameTs = nowPerf;

      const latestVisiblePrice = interpolateValueAt(visualNow) ?? lastPriceRef.current;
      if (latestVisiblePrice != null) {
        const nextTargetAxis = buildTargetAxis(latestVisiblePrice, visualNow);
        targetAxisRef.current = nextTargetAxis;
        if (!currentAxisRef.current) currentAxisRef.current = nextTargetAxis;
      }

      const targetAxis = targetAxisRef.current;
      if (targetAxis && !currentAxisRef.current) currentAxisRef.current = targetAxis;
      if (targetAxis && currentAxisRef.current) {
        const currentAxis = currentAxisRef.current;
        const amount = 1 - Math.exp(-AXIS_EASE_PER_SECOND * dt);
        currentAxisRef.current = {
          min: lerp(currentAxis.min, targetAxis.min, amount),
          max: lerp(currentAxis.max, targetAxis.max, amount),
        };
      }

      const range = currentAxisRef.current;
      const rootStyle = getComputedStyle(document.documentElement);
      const bgColor = rootStyle.getPropertyValue('--bg-glass').trim() || 'rgba(17,24,39,0.5)';
      const borderColor = rootStyle.getPropertyValue('--border-primary').trim() || 'rgba(255,255,255,0.1)';
      const textColor = rootStyle.getPropertyValue('--text-secondary').trim() || '#cbd5e1';
      const lineColor = rootStyle.getPropertyValue('--accent-gold').trim() || '#fbbf24';

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

      obstaclesRef.current = obstaclesRef.current.filter((obstacle) => {
        return timeToX(obstacle.spawnT, visualNow, w) > LEFT_PAD - obstacle.width;
      });

      if (range) {
        const ticks = computeTicks(range.min, range.max);

        ctx.save();
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1;
        ctx.font = '12px ui-sans-serif, system-ui, -apple-system';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        for (const tickValue of ticks) {
          const y = valueToY(tickValue, h, range);

          ctx.beginPath();
          ctx.moveTo(LEFT_PAD, y);
          ctx.lineTo(w - RIGHT_PAD, y);
          ctx.stroke();

          ctx.fillStyle = textColor;
          ctx.fillText(formatTick(tickValue), 8, y);
        }

        ctx.beginPath();
        ctx.moveTo(LEFT_PAD, TOP_PAD);
        ctx.lineTo(LEFT_PAD, h - BOTTOM_PAD);
        ctx.stroke();
        ctx.restore();

        drawTimeGrid(ctx, visualNow, w, h, borderColor);

        const linePoints = buildLinePoints(visualNow, w, h, range);
        if (linePoints.length) {
          ctx.save();
          ctx.lineWidth = 2.5;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.strokeStyle = lineColor;
          ctx.shadowColor = 'rgba(251, 191, 36, 0.25)';
          ctx.shadowBlur = 8;
          drawStablePath(ctx, linePoints);
          ctx.stroke();
          ctx.restore();

          const currentPoint = linePoints[linePoints.length - 1];
          drawCurrentMarker(ctx, currentPoint.x, currentPoint.y, lineColor, nowPerf);
        }
      }

      if (gameState === 'playing' && gameStartRef.current != null) {
        const elapsedMs = nowPerf - gameStartRef.current;

        if (elapsedMs >= SPAWN_DELAY_MS) {
          const canSpawn = !lastSpawnRef.current || nowPerf - lastSpawnRef.current >= SPAWN_INTERVAL_MS;

          if (canSpawn && range) {
            const xRight = getPlotRight(w);
            const lineY = getLineYAtX(xRight, visualNow, w, h, range);

            if (lineY != null) {
              const minHeight = 20;
              const maxHeight = Math.max(minHeight, lineY - MIN_GAP_FROM_LINE_PX);

              if (maxHeight > minHeight) {
                const height = minHeight + Math.random() * (maxHeight - minHeight);
                const gapFromLinePx = lineY - height;
                obstaclesRef.current.push({
                  spawnT: visualNow,
                  width: OBSTACLE_WIDTH_PX,
                  gapFromLinePx,
                  initialHeight: height,
                });
                lastSpawnRef.current = nowPerf;
              }
            }
          }
        }
      }

      if (obstaclesRef.current.length) {
        ctx.save();
        ctx.fillStyle = '#ef4444';
        ctx.shadowColor = 'rgba(239, 68, 68, 0.4)';
        ctx.shadowBlur = 6;

        for (const obstacle of obstaclesRef.current) {
          const xRight = timeToX(obstacle.spawnT, visualNow, w);
          const reveal = Math.max(0, Math.min(1, (visualNow - obstacle.spawnT) / REVEAL_DURATION_MS));
          const easedReveal = 1 - Math.pow(1 - reveal, 3);
          const effectiveWidth = obstacle.width * easedReveal;
          const xLeft = xRight - effectiveWidth;
          let height = obstacle.initialHeight;

          if (range) {
            const lineYNow = getLineYAtX(xRight, visualNow, w, h, range);
            if (lineYNow != null) {
              height = Math.max(20, Math.min(h, lineYNow - obstacle.gapFromLinePx));
            }
          }

          ctx.fillRect(xLeft, 0, effectiveWidth, height);
        }

        ctx.restore();
      }

      let currentBirdY = birdYRef.current;

      if (gameState === 'playing') {
        birdVYRef.current += GRAVITY * dt;
        birdYRef.current += birdVYRef.current * dt;
        currentBirdY = birdYRef.current;

        if (gameStartRef.current != null) {
          scoreSecondsRef.current = (nowPerf - gameStartRef.current) / 1000;
        }

        const topBound = 10 + BIRD_SIZE / 2;
        const bottomBound = h - 10 - BIRD_SIZE / 2;

        if (currentBirdY < topBound) {
          birdYRef.current = topBound;
          birdVYRef.current = 0;
          currentBirdY = topBound;
        }

        if (currentBirdY > bottomBound) {
          if (gameOverAtRef.current == null) gameOverAtRef.current = nowPerf;
          setGameState('gameover');
        }

        if (range) {
          const lineY = getLineYAtX(BIRD_X, visualNow, w, h, range);
          if (lineY != null && Math.abs(currentBirdY - lineY) <= BIRD_SIZE / 2) {
            if (gameOverAtRef.current == null) gameOverAtRef.current = nowPerf;
            setGameState('gameover');
          }
        }
      }

      const logo = logoImgRef.current;
      if (logo && logoLoadedRef.current) {
        const drawX = BIRD_X - BIRD_SIZE / 2;
        const drawY = gameState === 'idle' ? 20 : currentBirdY - BIRD_SIZE / 2;
        ctx.drawImage(logo, drawX, drawY, BIRD_SIZE, BIRD_SIZE);
      }

      ctx.save();
      ctx.fillStyle = textColor;
      ctx.font = '14px ui-sans-serif, system-ui, -apple-system';
      ctx.textBaseline = 'top';

      if (gameState === 'idle') {
        const idleStart = idleStartRef.current;
        if (idleStart != null) {
          const elapsed = nowPerf - idleStart;
          if (elapsed >= 5000) {
            const x = w - ((elapsed - 5000) / 1000) * 120;
            ctx.font = '16px ui-sans-serif, system-ui, -apple-system';
            ctx.fillStyle = '#e5e7eb';
            ctx.fillText('press space to start', x, 8);
          }
        }
      } else if (gameState === 'playing') {
        ctx.fillText(`Score: ${Math.floor(scoreSecondsRef.current)}`, w - 96, 16);
      } else if (gameState === 'gameover') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, w, h);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.font = '28px ui-sans-serif, system-ui, -apple-system';
        ctx.fillText('Game Over', w / 2, h / 2 - 20);
        ctx.font = '20px ui-sans-serif, system-ui, -apple-system';
        ctx.fillText(`Score: ${Math.floor(scoreSecondsRef.current)}`, w / 2, h / 2 + 6);
        ctx.font = '16px ui-sans-serif, system-ui, -apple-system';
        ctx.fillStyle = '#e5e7eb';
        ctx.fillText('Press Space to play again', w / 2, h / 2 + 30);
      }

      ctx.restore();

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [gameState]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        maxWidth: 600,
        margin: '1rem auto 0',
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid var(--border-primary)',
        boxShadow: 'var(--shadow-lg)',
        background: 'var(--bg-glass)',
      }}
    >
      <canvas ref={canvasRef} />
    </div>
  );
};

export default PriceChartGame;
