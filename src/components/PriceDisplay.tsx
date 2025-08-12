import React from 'react';
import { PriceFeed } from '../types';
import PriceChartGame from './PriceChartGame';

interface PriceDisplayProps {
  price: number | null;
  selectedFeed?: PriceFeed;
  feedAddress: string | null;
  updateCount: number;
}

const PriceDisplay: React.FC<PriceDisplayProps> = ({
  price,
  selectedFeed,
  feedAddress,
  updateCount,
}) => {
  const [startTime, setStartTime] = React.useState(Date.now());
  const [updatesPerSecond, setUpdatesPerSecond] = React.useState(0);
  const [msPerUpdate, setMsPerUpdate] = React.useState(0);

  React.useEffect(() => {
    setStartTime(Date.now());
    setUpdatesPerSecond(0);
    setMsPerUpdate(0);
  }, [selectedFeed?.name]);

  React.useEffect(() => {
    if (updateCount > 0) {
      const elapsedSeconds = (Date.now() - startTime) / 1000;
      const ups = updateCount / elapsedSeconds;
      setUpdatesPerSecond(ups);
      
      const msPerUpdate = elapsedSeconds * 1000 / updateCount;
      setMsPerUpdate(msPerUpdate);
    }
  }, [updateCount, startTime]);

  const formatPrice = (value: number, exponent: number): string => {
    console.log('value', value);
    console.log('exponent', exponent);
    const formattedValue = value / Math.pow(10, Math.abs(exponent));
    
    // For prices under $10, show more precision
    const isUnderTwo = formattedValue <= 100;
    const decimals = isUnderTwo ? 10 : 3;
    
    let formatted = formattedValue.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    
    // Remove leading zeroes but keep one zero before decimal point
    formatted = formatted.replace(/^0+(?=\d)/, '0');
    
    return formatted;
  };

  const normalizedPrice = React.useMemo(() => {
    if (price == null || !selectedFeed) return null;
    return price / Math.pow(10, Math.abs(selectedFeed.exponent));
  }, [price, selectedFeed]);

  return (
    <div className="price-display">
      <div className="price-container">
        {price !== null && selectedFeed ? (
          <>
            <span className="currency-symbol">$</span>
            <span className="price-value">
              {formatPrice(price, selectedFeed.exponent)}
            </span>
          </>
        ) : (
          <span className="placeholder">
            {selectedFeed ? 'Loading price...' : 'Select a price feed'}
          </span>
        )}
      </div>

      {/* Chart + Game */}
      <PriceChartGame price={normalizedPrice} feedKey={selectedFeed ? selectedFeed.name : null} />

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
            
            <div className="metric-block">
              <div className="metric-label">Updates/Second</div>
              <div className="metric-value">{updatesPerSecond.toFixed(2)}</div>
            </div>
            
            <div className="metric-block">
              <div className="metric-label">ms/Update</div>
              <div className="metric-value">{msPerUpdate.toFixed(0)}</div>
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

        .update-counter {
          font-size: 0.875rem;
          color: var(--text-muted);
          line-height: 1.6;
          margin: 0.5rem 0 0 0;
        }

        .metrics-container {
          display: flex;
          gap: 1rem;
          margin-top: 2rem;
          justify-content: center;
          width: 100%;
          max-width: 600px;
        }

        .metric-block {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 2rem 1.5rem;
          background: var(--bg-glass);
          border-radius: 16px;
          backdrop-filter: blur(20px);
          border: 1px solid var(--border-primary);
          box-shadow: var(--shadow-lg);
          flex: 1;
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


      `}</style>
    </div>
  );
};

export default PriceDisplay; 