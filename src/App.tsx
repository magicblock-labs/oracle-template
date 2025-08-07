import React, { useState } from 'react';
import PriceFeedAccordion from './components/PriceFeedAccordion';
import PriceDisplay from './components/PriceDisplay';
import { useSolanaWebSocket } from './hooks/useSolanaWebSocket';
import { PriceFeed } from './types';
import priceFeedsData from '../pyth_lazer_list.json';

function App() {
  const [selectedFeed, setSelectedFeed] = useState<PriceFeed | undefined>(
    // Start with BTCUSD as default
    (priceFeedsData as PriceFeed[]).find(feed => feed.name === 'BTCUSD')
  );

  const { price, isConnected, isConnecting, error, feedAddress } = useSolanaWebSocket(selectedFeed);

  const handleSelectFeed = (feed: PriceFeed) => {
    setSelectedFeed(feed);
    console.log('Selected feed:', feed);
  };

  return (
    <div className="app">
      <div className="container">
        <header className="header">
          <h1 className="title">Magicblock Pyth Template</h1>
          <p className="subtitle">This is an example template, showing off how to integrate and use Pyth on a Magicblock Ephemeral Rollup.</p>
        </header>

        <div className="content">
          <PriceFeedAccordion
            onSelectFeed={handleSelectFeed}
            selectedFeed={selectedFeed}
          />

          <PriceDisplay
            price={price}
            selectedFeed={selectedFeed}
            isConnected={isConnected}
            isConnecting={isConnecting}
            feedAddress={feedAddress}
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
            <a href="https://solana.com" target="_blank" rel="noopener noreferrer">
              Solana
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
          font-size: 1.25rem;
          color: var(--text-muted);
          font-weight: 400;
          max-width: 600px;
          margin: 0 auto;
        }

        .content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2rem;
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