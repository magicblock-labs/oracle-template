import React, { useState, useMemo, useEffect, useRef } from 'react';
import { PriceFeed } from '../types';
import priceFeedsData from '../../pyth_lazer_list.json';
import { PublicKey } from '@solana/web3.js';
import { Buffer } from 'buffer';

interface PriceFeedAccordionProps {
  onSelectFeed: (feed: PriceFeed) => void;
  selectedFeed?: PriceFeed;
}

const PROGRAM_ID = new PublicKey('PriCems5tHihc6UDXDjzjeawomAwBduWMGAi8ZUjppd');

const PriceFeedAccordion: React.FC<PriceFeedAccordionProps> = ({
  onSelectFeed,
  selectedFeed,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const accordionRef = useRef<HTMLDivElement>(null);

  const priceFeeds = priceFeedsData as PriceFeed[];

  const deriveFeedAddress = (feedId: number): string => {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from('price_feed'),
        Buffer.from('pyth-lazer'),
        Buffer.from(feedId.toString())
      ],
      PROGRAM_ID
    )[0].toString();
  };

  const filteredFeeds = useMemo(() => {
    if (!searchTerm) return priceFeeds;
    
    const term = searchTerm.toLowerCase();
    return priceFeeds.filter(
      feed =>
        feed.name.toLowerCase().includes(term) ||
        feed.description.toLowerCase().includes(term) ||
        feed.symbol.toLowerCase().includes(term)
    );
  }, [searchTerm, priceFeeds]);

  const handleSelectFeed = (feed: PriceFeed) => {
    onSelectFeed(feed);
    setIsOpen(false);
    setSearchTerm('');
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accordionRef.current && !accordionRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="price-feed-accordion" ref={accordionRef}>
      <div 
        className="accordion-header"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="header-content">
          <div className="selected-feed">
            {selectedFeed ? (
              <>
                <span className="feed-ticker">{selectedFeed.name}</span>
                <span className="feed-name-subtext">{selectedFeed.description}</span>
              </>
            ) : (
              'Select a Price Feed'
            )}
          </div>
          <span className={`arrow ${isOpen ? 'open' : ''}`}>▼</span>
        </div>
      </div>
      
      {isOpen && (
        <div className="accordion-content">
          <div className="search-container">
            <input
              type="text"
              placeholder="Search price feeds..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
              autoFocus
            />
          </div>
          
          <div className="feeds-list">
            {filteredFeeds.map((feed) => {
              const feedAddress = deriveFeedAddress(feed.pyth_lazer_id);
              return (
                <div
                  key={feed.pyth_lazer_id}
                  className={`feed-item ${selectedFeed?.pyth_lazer_id === feed.pyth_lazer_id ? 'selected' : ''}`}
                  onClick={() => handleSelectFeed(feed)}
                >
                  <div className="feed-header">
                    <div className="feed-name">{feed.name}</div>
                    <a 
                      href={`https://explorer.solana.com/address/${feedAddress}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="feed-address-link"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {feedAddress.slice(0, 8)}...{feedAddress.slice(-8)}
                    </a>
                  </div>
                  <div className="feed-description">{feed.description}</div>
                </div>
              );
            })}
            
            {filteredFeeds.length === 0 && (
              <div className="no-results">No price feeds found</div>
            )}
          </div>
        </div>
      )}
      
      <style>{`
        .price-feed-accordion {
          background: var(--bg-card);
          border-radius: 16px;
          backdrop-filter: blur(20px);
          border: 1px solid var(--border-primary);
          margin: 0;
          box-shadow: var(--shadow-lg);
          transition: all 0.3s ease;
          overflow: visible; /* Changed from hidden to allow overlay */
          position: relative;
          z-index: 10; /* Ensure it appears above other content */
          flex: 1;
        }

        .price-feed-accordion:hover {
          border-color: var(--border-accent);
          box-shadow: var(--shadow-xl);
          transform: translateY(-2px);
        }

        .accordion-header {
          padding: 1.25rem 1.5rem;
          min-width: 400px;
          cursor: pointer;
          transition: all 0.2s ease;
          background: var(--bg-glass);
          position: relative;
          border-radius: 16px; /* Ensure header has rounded corners */
        }

        .accordion-header::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, var(--border-accent), transparent);
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .accordion-header:hover::before {
          opacity: 1;
        }

        .accordion-header:hover {
          background: var(--bg-card-hover);
        }

        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .selected-feed {
          font-weight: 600;
          font-size: 1.125rem;
          color: var(--text-primary);
          letter-spacing: 0.025em;
        }

        .feed-ticker {
          font-weight: 600;
          font-size: 1.125rem;
          color: var(--text-primary);
          letter-spacing: 0.025em;
        }

        .feed-name-subtext {
          font-weight: 400;
          font-size: 0.875rem;
          color: var(--text-muted);
          margin-left: 0.5rem;
          letter-spacing: 0.025em;
        }

        .arrow {
          transition: all 0.3s ease;
          font-size: 0.875rem;
          color: var(--text-muted);
          font-weight: 600;
        }

        .arrow.open {
          transform: rotate(180deg);
          color: var(--text-accent);
        }

        .accordion-content {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: var(--bg-secondary);
          border: 1px solid var(--border-primary);
          border-top: none;
          border-radius: 0 0 16px 16px;
          box-shadow: var(--shadow-xl);
          backdrop-filter: blur(20px);
          z-index: 20;
          max-height: 400px;
          overflow: hidden;
          animation: slideDown 0.3s ease-out;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
            max-height: 0;
          }
          to {
            opacity: 1;
            transform: translateY(0);
            max-height: 400px;
          }
        }

        .search-container {
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid var(--border-secondary);
          background: var(--bg-glass);
        }

        .search-input {
          width: 100%;
          padding: 0.875rem 1.25rem;
          border: 1px solid var(--border-primary);
          border-radius: 12px;
          background: var(--bg-card);
          color: var(--text-primary);
          font-size: 1rem;
          outline: none;
          transition: all 0.2s ease;
          font-weight: 500;
        }

        .search-input::placeholder {
          color: var(--text-muted);
          font-weight: 400;
        }

        .search-input:focus {
          border-color: var(--border-accent);
          background: var(--bg-card-hover);
          box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.1);
        }

        .feeds-list {
          max-height: 320px;
          overflow-y: auto;
        }

        .feed-item {
          padding: 1.25rem 1.5rem;
          cursor: pointer;
          border-bottom: 1px solid var(--border-secondary);
          transition: all 0.2s ease;
          position: relative;
        }

        .feed-item::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 0;
          background: var(--accent-gradient);
          transition: width 0.2s ease;
        }

        .feed-item:hover {
          background: var(--bg-card);
          transform: translateX(4px);
        }

        .feed-item:hover::before {
          width: 3px;
        }

        .feed-item.selected {
          background: var(--bg-card-hover);
          border-color: var(--border-accent);
        }

        .feed-item.selected::before {
          width: 3px;
        }

        .feed-item:last-child {
          border-bottom: none;
        }

        .feed-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.375rem;
        }

        .feed-name {
          font-weight: 600;
          font-size: 1rem;
          color: var(--text-primary);
          letter-spacing: 0.025em;
        }

        .feed-address-link {
          font-size: 0.75rem;
          color: var(--accent-gold);
          text-decoration: none;
          font-weight: 500;
          padding: 0.25rem 0.5rem;
          border-radius: 6px;
          background: rgba(251, 191, 36, 0.1);
          border: 1px solid rgba(251, 191, 36, 0.2);
          transition: all 0.2s ease;
          font-family: 'Courier New', monospace;
        }

        .feed-address-link:hover {
          background: rgba(251, 191, 36, 0.2);
          border-color: rgba(251, 191, 36, 0.4);
          color: var(--text-accent);
          transform: translateY(-1px);
        }

        .feed-description {
          font-size: 0.875rem;
          color: var(--text-muted);
          line-height: 1.5;
          font-weight: 400;
        }

        .no-results {
          padding: 3rem 2rem;
          text-align: center;
          color: var(--text-muted);
          font-style: italic;
          font-size: 1rem;
          background: var(--bg-glass);
        }


      `}</style>
    </div>
  );
};

export default PriceFeedAccordion; 