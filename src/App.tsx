import { useState } from 'react';
import PriceFeedAccordion from './components/PriceFeedAccordion';
import PriceDisplay from './components/PriceDisplay';
import { useSolanaWebSocket } from './hooks/useSolanaWebSocket';
import { PriceFeed } from './types';
import priceFeedsData from '../pyth_lazer_list.json';

function App() {
  const [selectedFeed, setSelectedFeed] = useState<PriceFeed | undefined>(
    (priceFeedsData as PriceFeed[]).find(feed => feed.name === 'BTCUSD')
  );

  const { price, isConnected, isConnecting, error, feedAddress, updateCount } = useSolanaWebSocket(selectedFeed);

  const handleSelectFeed = (feed: PriceFeed) => {
    setSelectedFeed(feed);
    console.log('Selected feed:', feed);
  };

  const getStatusColor = (): string => {
    if (isConnecting) return '#ffa500';
    if (isConnected) return '#4ade80';
    return '#ef4444';
  };

  const getStatusText = (): string => {
    if (isConnecting) return 'Connecting...';
    if (isConnected) return 'Connected';
    return 'Disconnected';
  };

  return (
    <div className="app">
      <div className="container">
        <header className="header">
          <h1 className="title">MagicBlock Real-Time Oracle</h1>
          <p className="subtitle">This is an example showing how to integrate and use an Oracle (Pyth Price Feeds)from a <a href="https://docs.magicblock.gg/pages/get-started/introduction/ephemeral-rollup" target="_blank" rel="noopener noreferrer">Magicblock Ephemeral Rollup</a>. Get started using Magicblock <a href="https://docs.magicblock.gg/pages/get-started/how-integrate-your-program/quickstart" target="_blank" rel="noopener noreferrer">here</a>.</p>
        </header>

        <div className="content">
          <div className="accordion-section">
            <PriceFeedAccordion
              onSelectFeed={handleSelectFeed}
              selectedFeed={selectedFeed}
            />
            
            <div className="status-indicator">
              <div 
                className="status-dot"
                style={{ backgroundColor: getStatusColor() }}
              />
              <span className="status-text">{getStatusText()}</span>
            </div>
          </div>

          <PriceDisplay
            price={price}
            selectedFeed={selectedFeed}
            feedAddress={feedAddress}
            updateCount={updateCount}
          />

          {error && (
            <div className="error-message">
              <p>⚠️ {error}</p>
            </div>
          )}
        </div>

        <footer className="footer">
          <p>
            Powered by{' '}
            <a href="https://pyth.network" target="_blank" rel="noopener noreferrer">
              Pyth Network
            </a>{' '}
            on{' '}
            <a href="https://magicblock.xyz" target="_blank" rel="noopener noreferrer">
              Magicblock
            </a>
            {' • '}
            <a href="https://github.com/magicblock-labs/defi-template" target="_blank" rel="noopener noreferrer">
              Fork this repo on GitHub
            </a>
          </p>
        </footer>
      </div>

      <style>{`
        .app {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          width: 100%;
        }

        .header {
          text-align: center;
          margin-bottom: 3rem;
        }

        .title {
          font-size: 3rem;
          font-weight: 800;
          margin-bottom: 0.5rem;
          background: linear-gradient(135deg, var(--text-primary) 0%, var(--accent-gold) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          text-shadow: 0 0 30px rgba(59, 130, 246, 0.2);
          letter-spacing: -0.02em;
        }

        .subtitle {
          font-size: 1rem;
          color: var(--text-muted);
          font-weight: 400;
          max-width: 600px;
          margin: 0 auto;
        }

        .subtitle a {
          color: var(--accent-gold);
          text-decoration: none;
          font-weight: 500;
          transition: all 0.2s ease;
          position: relative;
          border-bottom: 1px solid transparent;
        }

        .subtitle a:hover {
          color: var(--text-accent);
          border-bottom: 1px solid var(--text-accent);
        }

        .content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0 rem;
        }

        .accordion-section {
          display: flex;
          align-items: center;
          gap: 1rem;
          justify-content: center;
          margin-bottom: 2rem;
          max-width: 600px;
          width: 100%;
          margin-left: auto;
          margin-right: auto;
        }

        .status-indicator {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.25rem;
          background: var(--bg-card);
          border-radius: 24px;
          backdrop-filter: blur(20px);
          border: 1px solid var(--border-primary);
          box-shadow: var(--shadow-lg);
          transition: all 0.3s ease;
        }

        .status-indicator:hover {
          background: var(--bg-card-hover);
          transform: translateY(-2px);
          box-shadow: var(--shadow-lg);
        }

        .status-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          transition: all 0.3s ease;
          box-shadow: 0 0 10px currentColor;
        }

        .status-text {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--text-secondary);
          letter-spacing: 0.025em;
        }

        .error-message {
          position: fixed;
          top: 2rem;
          right: 2rem;
          background: var(--status-error);
          color: white;
          padding: 1rem 1.5rem;
          border-radius: 12px;
          backdrop-filter: blur(20px);
          font-weight: 500;
          z-index: 1000;
          max-width: 300px;
          word-wrap: break-word;
          box-shadow: var(--shadow-lg);
          border: 1px solid rgba(239, 68, 68, 0.2);
          animation: slideIn 0.3s ease-out;
        }

        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .footer {
          text-align: center;
          padding: 2rem 0;
          margin-top: auto;
          color: var(--text-muted);
          font-size: 0.875rem;
          border-top: 1px solid var(--border-secondary);
        }

        .footer a {
          color: var(--accent-gold);
          text-decoration: none;
          font-weight: 500;
          transition: all 0.2s ease;
          position: relative;
        }

        .footer a:hover {
          color: var(--text-accent);
          transform: translateY(-1px);
        }

        .footer a::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 0;
          width: 0;
          height: 1px;
          background: var(--text-accent);
          transition: width 0.2s ease;
        }

        .footer a:hover::after {
          width: 100%;
        }


      `}</style>
    </div>
  );
}

export default App; 