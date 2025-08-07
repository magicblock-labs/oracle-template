# Solana Price Feed Dashboard

A modern, real-time cryptocurrency price dashboard that connects to Solana blockchain to display Pyth Network price feeds. Features a sleek UI with searchable price feed selection and live price updates via WebSocket connections.

## Features

- 🔄 **Real-time Price Updates**: WebSocket connection to Solana blockchain for live data
- 🔍 **Searchable Price Feeds**: Filter through 100+ cryptocurrency price feeds
- 📱 **Responsive Design**: Modern, sleek UI that works on all devices
- ⚡ **Fast Performance**: Built with React and TypeScript for optimal performance
- 🎨 **Glass Morphism UI**: Beautiful gradient backgrounds with backdrop blur effects

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Blockchain**: Solana Web3.js
- **Styling**: CSS-in-JS with styled-jsx
- **Data Source**: Pyth Network price feeds

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

## Troubleshooting

### Common Issues

1. **WebSocket Connection Errors**: Check your internet connection and ensure you're not behind a restrictive firewall
2. **Price Data Not Loading**: Some feeds may not be active or available. Try selecting a different cryptocurrency
3. **Build Errors**: Make sure all dependencies are installed with `npm install`

### Browser Compatibility

The application works best with modern browsers that support:
- ES2020 features
- WebSocket connections
- CSS backdrop-filter

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source and available under the MIT License.

## Acknowledgments

- [Pyth Network](https://pyth.network) for providing decentralized price feeds
- [Solana](https://solana.com) for the high-performance blockchain infrastructure
- Price feed data sourced from Pyth Lazer program 