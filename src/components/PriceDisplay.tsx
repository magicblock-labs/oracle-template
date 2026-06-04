import React from 'react';
import { PriceFeed } from '../types';
import PriceChartGame from './PriceChartGame';
import { formatDisplayPrice, getQuoteSymbol, normalizePrice } from '../utils/priceUtils';

interface PriceDisplayProps {
  price: number | null;
  selectedFeed?: PriceFeed;
  feedAddress: string | null;
  updateCount: number;
}

interface PriceStreamItem {
  id: number;
  label: string;
  trend: 'up' | 'down' | 'flat';
  lane: number;
}

const STREAM_ITEM_LIMIT = 42;
const STREAM_LANE_COUNT = 3;
const STREAM_LANE_GAP_PERCENT = 28;

const PriceDisplay: React.FC<PriceDisplayProps> = ({
  price,
  selectedFeed,
  feedAddress,
  updateCount,
}) => {
  const [priceStream, setPriceStream] = React.useState<PriceStreamItem[]>([]);
  const [isStreamPaused, setIsStreamPaused] = React.useState(false);
  const streamIdRef = React.useRef(0);
  const previousStreamPriceRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    setPriceStream([]);
    setIsStreamPaused(false);
    streamIdRef.current = 0;
    previousStreamPriceRef.current = null;
  }, [selectedFeed?.pyth_lazer_id]);

  const normalizedPrice = React.useMemo(() => {
    if (price == null || !selectedFeed) return null;
    return normalizePrice(price, selectedFeed.exponent);
  }, [price, selectedFeed]);

  React.useEffect(() => {
    if (isStreamPaused || updateCount === 0 || normalizedPrice == null || !selectedFeed) return;

    const previousPrice = previousStreamPriceRef.current;
    const trend: PriceStreamItem['trend'] =
      previousPrice == null
        ? 'flat'
        : normalizedPrice > previousPrice
          ? 'up'
          : normalizedPrice < previousPrice
            ? 'down'
            : 'flat';
    const id = streamIdRef.current;

    streamIdRef.current += 1;
    previousStreamPriceRef.current = normalizedPrice;

    setPriceStream((items) => [
      ...items,
      {
        id,
        label: `${getQuoteSymbol(selectedFeed.quote_currency)}${formatDisplayPrice(normalizedPrice, selectedFeed)}`,
        trend,
        lane: id % STREAM_LANE_COUNT,
      },
    ].slice(-STREAM_ITEM_LIMIT));
  }, [isStreamPaused, updateCount, normalizedPrice, selectedFeed]);

  const chartKey = selectedFeed ? selectedFeed.pyth_lazer_id.toString() : 'no-feed';

  return (
    <div className="price-display">
      <div className="price-container">
        {price !== null && selectedFeed ? (
          <>
            <span className="currency-symbol">{getQuoteSymbol(selectedFeed.quote_currency)}</span>
            <span className="price-value">
              {normalizedPrice == null ? '...' : formatDisplayPrice(normalizedPrice, selectedFeed)}
            </span>
          </>
        ) : (
          <span className="placeholder">
            {selectedFeed ? 'Loading price...' : 'Select a price feed'}
          </span>
        )}
      </div>

      <PriceChartGame key={chartKey} price={normalizedPrice} feedKey={chartKey} />

      {feedAddress && selectedFeed && (
        <div className="account-info">
          <p className="account-text">
            This is processing directly from the associated onchain account:{' '}
            <a 
              href={`https://explorer.solana.com/address/${feedAddress}?cluster=custom&customUrl=https%3A%2F%2Fdevnet.magicblock.app`}
              target="_blank"
              rel="noopener noreferrer"
              className="account-link"
            >
              {feedAddress.slice(0, 4)}...{feedAddress.slice(-4)}
            </a>
          </p>
          
          <div className="metrics-container">
            <div className="metric-block">
              <div className="metric-label">Price Updates</div>
              <div className="metric-value">{updateCount}</div>
            </div>

            <div className="price-stream-module">
              <div className="stream-header">
                <div className="metric-label">Live Price Stream</div>
              </div>
              <div
                className="stream-window"
                aria-label="Live price update stream"
                onMouseEnter={() => setIsStreamPaused(true)}
                onMouseLeave={() => setIsStreamPaused(false)}
              >
                {priceStream.map((item) => (
                  <div
                    key={item.id}
                    className={`stream-price-block ${item.trend}`}
                    style={{
                      left: `${50 + (item.lane - (STREAM_LANE_COUNT - 1) / 2) * STREAM_LANE_GAP_PERCENT}%`,
                    }}
                  >
                    {item.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .price-display {
          display: flex;
          flex-direction: column;
          align-items: center;
          flex: 1;
          text-align: center;
          padding: 2rem;
        }

        .feed-info {
          margin-bottom: 3rem;
          max-width: 600px;
        }

        .feed-symbol {
          font-size: 2.5rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
          background: linear-gradient(135deg, var(--text-primary) 0%, var(--text-accent) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          letter-spacing: -0.02em;
        }

        .feed-name {
          font-size: 1.25rem;
          color: var(--text-muted);
          font-weight: 400;
          line-height: 1.5;
        }

        .price-container {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          margin-bottom: 0rem;
          padding: 2rem;
          background: var(--bg-glass);
          border-radius: 24px;
          backdrop-filter: blur(20px);
          border: 1px solid var(--border-primary);
          box-shadow: var(--shadow-lg);
          position: relative;
          overflow: hidden;
          width: 100%; /* Added fixed width */
          max-width: 600px; /* Added max-width */
        }

        .price-container::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, var(--border-accent), transparent);
        }

        .currency-symbol {
          font-size: 3.5rem;
          font-weight: 300;
          color: var(--text-muted);
          margin-top: -1rem;
          align-self: flex-start;
          opacity: 0.8;
        }

        .price-value {
          font-size: 4rem;
          font-weight: 700;
          line-height: 1;
          background: linear-gradient(135deg, var(--text-primary) 0%, var(--accent-gold) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          text-shadow: 0 0 30px rgba(59, 130, 246, 0.2);
          letter-spacing: -0.02em;
          animation: pulse 2s ease-in-out infinite;
          font-variant-numeric: tabular-nums;
          min-width: 8ch;
          text-align: center;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.8;
          }
        }

        .placeholder {
          font-size: 2rem;
          font-weight: 400;
          color: var(--text-muted);
          font-style: italic;
          opacity: 0.7;
        }

        .account-info {
          margin-top: 1rem;
          max-width: 600px;
          width: 100%;
          text-align: center;
        }

        .account-text {
          font-size: 0.875rem;
          color: var(--text-muted);
          line-height: 1.6;
          margin: 0;
        }

        .account-link {
          color: var(--text-primary);
          text-decoration: none;
          font-weight: 600;
          transition: color 0.2s ease;
        }

        .account-link:hover {
          color: var(--text-accent);
        }

        .metrics-container {
          display: flex;
          gap: 1rem;
          margin-top: 2rem;
          justify-content: center;
          align-items: stretch;
          width: 100%;
          max-width: 600px;
        }

        .metric-block {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2rem 1.5rem;
          background: var(--bg-glass);
          border-radius: 16px;
          backdrop-filter: blur(20px);
          border: 1px solid var(--border-primary);
          box-shadow: var(--shadow-lg);
          flex: 0 0 188px;
        }

        .metric-label {
          font-size: 0.75rem;
          color: var(--text-muted);
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.5rem;
        }

        .metric-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--accent-gold);
          font-variant-numeric: tabular-nums;
          line-height: 1;
        }

        .price-stream-module {
          flex: 1;
          min-width: 0;
          padding: 1.25rem;
          background: var(--bg-glass);
          border-radius: 16px;
          backdrop-filter: blur(20px);
          border: 1px solid var(--border-primary);
          box-shadow: var(--shadow-lg);
        }

        .stream-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }

        .stream-window {
          position: relative;
          height: 96px;
          overflow: hidden;
          border-radius: 10px;
          border: 1px solid var(--border-secondary);
          background: rgba(0, 0, 0, 0.18);
        }

        .stream-window:hover .stream-price-block {
          animation-play-state: paused;
        }

        .stream-price-block {
          position: absolute;
          top: 0;
          width: 94px;
          padding: 0.42rem 0.45rem;
          border-radius: 8px;
          border: 1px solid rgba(196, 181, 253, 0.28);
          background: rgba(196, 181, 253, 0.11);
          color: var(--text-primary);
          font-size: 0.86rem;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
          text-align: center;
          box-shadow: 0 0 12px rgba(196, 181, 253, 0.12);
          animation: streamDown 0.56s linear forwards;
          will-change: transform, opacity;
        }

        .stream-price-block.up {
          color: #bbf7d0;
          border-color: rgba(74, 222, 128, 0.34);
          background: rgba(74, 222, 128, 0.1);
        }

        .stream-price-block.down {
          color: #fecaca;
          border-color: rgba(248, 113, 113, 0.34);
          background: rgba(248, 113, 113, 0.1);
        }

        @keyframes streamDown {
          0% {
            transform: translate(-50%, -120%);
            opacity: 0;
          }
          8% {
            opacity: 1;
          }
          88% {
            opacity: 1;
          }
          100% {
            transform: translate(-50%, 122px);
            opacity: 0;
          }
        }


      `}</style>
    </div>
  );
};

export default PriceDisplay;
