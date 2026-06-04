import { PriceFeed } from '../types';

// PriceUpdateV2 account discriminator + Pyth message fields place price at this byte.
const PYTH_LAZER_PRICE_OFFSET = 73;

export const parsePythLazerPrice = (data: Uint8Array): number | null => {
  if (data.byteLength < PYTH_LAZER_PRICE_OFFSET + 8) return null;

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const rawPrice = view.getBigInt64(PYTH_LAZER_PRICE_OFFSET, true);
  const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
  const minSafe = BigInt(Number.MIN_SAFE_INTEGER);

  if (rawPrice > maxSafe || rawPrice < minSafe) return null;

  return Number(rawPrice);
};

export const normalizePrice = (rawPrice: number, exponent: number): number => {
  return rawPrice * Math.pow(10, exponent);
};

export const getQuoteSymbol = (quoteCurrency?: string | null): string => {
  if (quoteCurrency === 'USD' || quoteCurrency == null) return '$';
  return quoteCurrency;
};

export const formatDisplayPrice = (value: number, feed: PriceFeed): string => {
  const absValue = Math.abs(value);

  if (feed.asset_type === 'equity' && feed.quote_currency === 'USD') {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  let minimumFractionDigits = 2;
  let maximumFractionDigits = 2;

  if (absValue >= 1000) {
    maximumFractionDigits = 2;
  } else if (absValue >= 100) {
    maximumFractionDigits = 3;
  } else if (absValue >= 1) {
    maximumFractionDigits = 4;
  } else if (absValue >= 0.01) {
    minimumFractionDigits = 4;
    maximumFractionDigits = 6;
  } else if (absValue >= 0.0001) {
    minimumFractionDigits = 6;
    maximumFractionDigits = 8;
  } else {
    minimumFractionDigits = 8;
    maximumFractionDigits = 10;
  }

  return value.toLocaleString('en-US', {
    minimumFractionDigits,
    maximumFractionDigits,
  });
};
