export interface PriceFeed {
  pyth_lazer_id: number;
  name: string;
  symbol: string;
  description: string;
  asset_type: string;
  exponent: number;
  cmc_id: number;
  interval: null | number;
  min_publishers: number;
  min_channel: string;
  state: string;
} 