# Magicblock Pyth Price Feed 

A modern, real-time cryptocurrency price dashboard that connects to a Magicblock Ephemeral Rollup to display Pyth Network price feeds.

## Prerequisites

- Node.js 16 or higher
- npm or yarn package manager

## Installation

1. **Clone or download the project**
   ```bash
   # If you have git
   git clone <repository-url>
   cd defi-template
   
   # Or download and extract the files to a folder
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:5173` to view the application.

## Usage

1. **Select a Price Feed**: Click on the dropdown at the top to browse and search through available cryptocurrency price feeds
2. **Search**: Use the search bar to quickly find specific cryptocurrencies by name, symbol, or description
3. **View Live Prices**: The selected price feed will display in real-time, updating automatically via WebSocket connection
4. **Connection Status**: Monitor the connection status indicator to ensure live data flow

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Configuration

The application connects to Solana mainnet by default. You can modify the RPC endpoints in `src/hooks/useSolanaWebSocket.ts`:

```typescript
const SOLANA_RPC_URL = 'https://api.mainnet-beta.solana.com';
const SOLANA_WS_URL = 'wss://api.mainnet-beta.solana.com';
```

## Price Feed Data

The application uses the `pyth_lazer_list.json` file which contains metadata for all available price feeds. Each feed includes:

- Feed ID and name
- Symbol and description
- Exponent for price formatting
- CoinMarketCap ID
- Update frequency and channel information

## Account Derivation

Price feed accounts are derived using:
```typescript
const feedAddress = PublicKey.findProgramAddressSync(
  [
    Buffer.from('price_feed'),
    Buffer.from('stork-oracle'),
    Buffer.from(feedName)
  ],
  PROGRAM_ID
)[0];
```

Where `PROGRAM_ID` is `PriCems5tHihc6UDXDjzjeawomAwBduWMGAi8ZUjppd`.

## License

This project is open source and available under the MIT License.
