# disbelief

**disbelief** is a lightning-fast, TypeScript-based application for discovering and purchasing new tokens on Solana, specifically those issued through the Believe app. By leveraging direct on-chain listening, parallelized metadata fetching, and advanced social scoring, disbelief is designed for speed, reliability, and extensibility.

## Features

- **Real-Time Token Discovery:** Listens directly to Solana on-chain events for new token launches via the Believe app.
- **Parallel Metadata Fetching:** Retrieves token metadata in parallel from multiple IPFS providers worldwide for maximum speed and redundancy.
- **Advanced Social Scoring:** Integrates with both the X (Twitter) API and TweetScout API to evaluate the credibility of token creators’ social profiles.
- **Automated Purchases:** Executes purchases through the Meteora SDK, filling transaction requests with all required data in under 2 seconds from discovery.
- **Extensible & Open Source:** Modular TypeScript codebase, easy to extend for new APIs or custom logic.

## How It Works

1. **On-Chain Listening:** The app monitors Solana for new token launches from the Believe app.
2. **Metadata Retrieval:** Upon detection, it fetches token metadata in parallel from several geographically distributed IPFS gateways.
3. **Profile Validation:** The creator’s X (Twitter) profile is scored using both the official API and TweetScout for authenticity and quality.
4. **Automated Purchase:** If the profile passes validation, the app constructs and submits a purchase transaction via the Meteora SDK.

## Performance

- **End-to-End Latency:** ~2 seconds from token discovery to purchase.
- **Global Redundancy:** Multiple IPFS providers ensure fast, reliable metadata access.
- **Parallel Processing:** All network-bound operations are parallelized for maximum throughput.

## Integrations

- [Solana Blockchain](https://solana.com/)
- [Believe App](https://believe.app/)
- [X (Twitter) API](https://developer.twitter.com/)
- [TweetScout API](https://tweetscout.io/)
- [Metaplex](https://www.metaplex.com/)
- [Meteora SDK](https://meteora.ag/)

## Getting Started

### Prerequisites

- Node.js (v16+ recommended)
- Yarn or npm
- Solana CLI (for wallet management)
- API keys for X (Twitter), TweetScout, and any required IPFS providers

### Installation

```bash
git clone https://github.com/yourusername/disbelief.git
cd disbelief
yarn install
```

### Configuration

Create a `.env` file in the project root with your API keys and configuration:

```env
TWITTER_API_KEY=your_twitter_key
TWEETSCOUT_API_KEY=your_tweetscout_key
IPFS_PROVIDERS=provider1,provider2,provider3
# ...other config
```

### Running the App

```bash
yarn start
```

## Contributing

Contributions are welcome! Please open issues or pull requests for new features, bug fixes, or improvements.

## License

[MIT](LICENSE)

---

**disbelief** is built for speed, reliability, and transparency. We hope it helps you stay ahead in the fast-moving Solana ecosystem!
