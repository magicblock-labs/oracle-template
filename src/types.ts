export interface PriceFeed {
  pyth_lazer_id: number;
  name: string;
  symbol: string;
  description: string;
  asset_type: string;
  instrument_type?: string;
  exponent: number;
  cmc_id: number | null;
  interval: null | number | string;
  min_publishers: number;
  min_channel: string;
  state: string;
  quote_currency?: string | null;
  nasdaq_symbol?: string | null;
}
