import { useEffect, useRef, useState, useCallback } from 'react';
import { Connection, PublicKey, AccountInfo } from '@solana/web3.js';
import { PriceFeed } from '../types';
import { Buffer } from 'buffer';



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

export const useMagicblockWebSocket = (selectedFeed?: PriceFeed): UseMagicblockWebSocketResult => {
  const [price, setPrice] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedAddress, setFeedAddress] = useState<string | null>(null);
  const [updateCount, setUpdateCount] = useState(0);
  
  const connectionRef = useRef<Connection | null>(null);
  const subscriptionIdRef = useRef<number | null>(null);

  const deriveFeedAddress = useCallback((feedName: string): PublicKey => {
    console.log('Feed name:', feedName);
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
    console.log('account data length', accountInfo.data.length);

    try {
      const dataView = new DataView(accountInfo.data.buffer);
      const priceOffset = 73; // This could change if account structure changes in future.
      const priceInt = Number(dataView.getBigUint64(priceOffset, true));
      return priceInt;
    } catch (err) {
      console.error('Error parsing account data:', err);
      return null;
    }
  }, []);

  const handleAccountChange = useCallback((accountInfo: AccountInfo<Buffer> | null) => {
    const newPrice = parseAccountData(accountInfo);
    setPrice(newPrice);
    setError(null);
    setUpdateCount(prev => prev + 1);
  }, [parseAccountData]);

  const subscribeToAccount = useCallback(async (feedAddress: PublicKey) => {
    if (!connectionRef.current) return;

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
        handleAccountChange,
        'confirmed'
      );

      // Get initial account data
      const accountInfo = await connectionRef.current.getAccountInfo(feedAddress);
      handleAccountChange(accountInfo);

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
    };
  }, []);

  // Subscribe to selected feed
  useEffect(() => {
    if (!selectedFeed || !connectionRef.current) {
      setPrice(null);
      setIsConnected(false);
      setIsConnecting(false);
      setFeedAddress(null);
      setUpdateCount(0);
      return;
    }

    try {
      const feedAddress = deriveFeedAddress(selectedFeed.pyth_lazer_id.toString());
      setFeedAddress(feedAddress.toString());
      setUpdateCount(0);
      subscribeToAccount(feedAddress);
    } catch (err) {
      console.error('Error deriving feed address:', err);
      setError('Failed to derive feed address');
      setIsConnected(false);
      setIsConnecting(false);
      setFeedAddress(null);
      setUpdateCount(0);
    }
  }, [selectedFeed, deriveFeedAddress, subscribeToAccount]);

  return {
    price,
    isConnected,
    isConnecting,
    error,
    feedAddress,
    updateCount,
  };
}; 