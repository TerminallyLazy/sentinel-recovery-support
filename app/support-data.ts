export const SUPPORT_WALLET =
  "0x91bdE13382c3Ee082EE42a147DF54f6A6129a412" as const;

export const ASSETS = [
  {
    symbol: "ETH",
    name: "Ether",
    contractAddress: null,
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    contractAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  },
] as const;
