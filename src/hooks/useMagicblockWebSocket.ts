import { useEffect, useRef, useState, useCallback } from 'react';
import { Connection, PublicKey, AccountInfo } from '@solana/web3.js';
import { PriceFeed } from '../types';
import { Buffer } from 'buffer';
import { parsePythLazerPrice } from '../utils/priceUtils';



const MAGICBLOCK_RPC_URL = 'https://devnet.magicblock.app';
const MAGICBLOCK_WS_URL = "wss://devnet.magicblock.app";
const PROGRAM_ID = new PublicKey('PriCems5tHihc6UDXDjzjeawomAwBduWMGAi8ZUjppd');


interface UseMagicblockWebSocketResult {
  price: number | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  feedAddress: string | null;
  updateCount: number;
}

interface PriceState {
  feedId: number;
  value: number | null;
}

export const useMagicblockWebSocket = (selectedFeed?: PriceFeed): UseMagicblockWebSocketResult => {
  const [priceState, setPriceState] = useState<PriceState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedAddress, setFeedAddress] = useState<string | null>(null);
  const [updateCount, setUpdateCount] = useState(0);
  
  const connectionRef = useRef<Connection | null>(null);
  const subscriptionIdRef = useRef<number | null>(null);
  const activeFeedAddressRef = useRef<string | null>(null);

  const deriveFeedAddress = useCallback((feedName: string): PublicKey => {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from('price_feed'),
        Buffer.from('pyth-lazer'),
        Buffer.from(feedName)
      ],
      PROGRAM_ID
    )[0];
  }, []);

  const parseAccountData = useCallback((accountInfo: AccountInfo<Buffer> | null): number | null => {
    if (!accountInfo || !accountInfo.data) return null;

    try {
      return parsePythLazerPrice(accountInfo.data);
    } catch (err) {
      console.error('Error parsing account data:', err);
      return null;
    }
  }, []);

  const handleAccountChange = useCallback((accountInfo: AccountInfo<Buffer> | null, feedId: number) => {
    const newPrice = parseAccountData(accountInfo);
    setPriceState({ feedId, value: newPrice });
    setError(null);
    setUpdateCount(prev => prev + 1);
  }, [parseAccountData]);

  const subscribeToAccount = useCallback(async (feedAddress: PublicKey, feedId: number) => {
    if (!connectionRef.current) return;
    const feedAddressText = feedAddress.toString();
    activeFeedAddressRef.current = feedAddressText;

    try {
      setIsConnecting(true);
      setError(null);

      // Unsubscribe from previous account if exists
      if (subscriptionIdRef.current !== null) {
        await connectionRef.current.removeAccountChangeListener(subscriptionIdRef.current);
        subscriptionIdRef.current = null;
      }

      // Subscribe to the new account
      subscriptionIdRef.current = connectionRef.current.onAccountChange(
        feedAddress,
        (accountInfo) => {
          if (activeFeedAddressRef.current !== feedAddressText) return;
          handleAccountChange(accountInfo, feedId);
        },
        'confirmed'
      );

      // Get initial account data
      const accountInfo = await connectionRef.current.getAccountInfo(feedAddress);
      if (activeFeedAddressRef.current !== feedAddressText) return;
      handleAccountChange(accountInfo, feedId);

      setIsConnected(true);
      setIsConnecting(false);
    } catch (err) {
      console.error('Error subscribing to account:', err);
      setError(err instanceof Error ? err.message : 'Failed to subscribe to account');
      setIsConnected(false);
      setIsConnecting(false);
    }
  }, [handleAccountChange]);

  // Initialize connection
  useEffect(() => {
    try {
      connectionRef.current = new Connection(MAGICBLOCK_RPC_URL, {
        wsEndpoint: MAGICBLOCK_WS_URL,
      });
    } catch (err) {
      console.error('Error creating connection:', err);
      setError('Failed to create Magicblock ephemeral rollup connection');
    }

    return () => {
      if (connectionRef.current && subscriptionIdRef.current !== null) {
        connectionRef.current.removeAccountChangeListener(subscriptionIdRef.current);
      }
      activeFeedAddressRef.current = null;
    };
  }, []);

  // Subscribe to selected feed
  useEffect(() => {
    if (!selectedFeed || !connectionRef.current) {
      activeFeedAddressRef.current = null;
      setPriceState(null);
      setIsConnected(false);
      setIsConnecting(false);
      setFeedAddress(null);
      setUpdateCount(0);
      return;
    }

    try {
      const feedAddress = deriveFeedAddress(selectedFeed.pyth_lazer_id.toString());
      setPriceState(null);
      setIsConnected(false);
      setIsConnecting(true);
      setError(null);
      setFeedAddress(feedAddress.toString());
      setUpdateCount(0);
      subscribeToAccount(feedAddress, selectedFeed.pyth_lazer_id);
    } catch (err) {
      console.error('Error deriving feed address:', err);
      setError('Failed to derive feed address');
      setIsConnected(false);
      setIsConnecting(false);
      setFeedAddress(null);
      setUpdateCount(0);
    }
  }, [selectedFeed, deriveFeedAddress, subscribeToAccount]);

  const price =
    selectedFeed && priceState?.feedId === selectedFeed.pyth_lazer_id
      ? priceState.value
      : null;

  return {
    price,
    isConnected,
    isConnecting,
    error,
    feedAddress,
    updateCount,
  };
};
