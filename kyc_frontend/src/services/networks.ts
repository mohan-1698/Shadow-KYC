import { defineChain } from "viem";
import { sepolia } from "viem/chains";

// Re-export the built-in Sepolia chain from viem
export { sepolia };

/**
 * DataHaven (StorageHub) Testnet — Chain ID 55931
 * Used exclusively for bucket / file storage after ZK proof is complete.
 */
export const dataHavenTestnet = defineChain({
  id: 55931,
  name: "DataHaven Testnet",
  nativeCurrency: {
    name: "DHT",
    symbol: "DHT",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://services.datahaven-testnet.network/testnet"],
      webSocket: ["wss://services.datahaven-testnet.network/testnet"],
    },
  },
  testnet: true,
});

/**
 * Network configuration.
 *  - sepolia  → default wallet connection, ZK proofs, on-chain verification
 *  - dataHaven → bucket/file storage for KYC extracted data
 */
export const NETWORKS = {
  sepolia: {
    chainId: 11155111,
    name: "Sepolia Testnet",
    rpcUrl: "https://rpc.sepolia.org",
    blockExplorer: "https://sepolia.etherscan.io",
  },
  dataHaven: {
    chainId: 55931,
    name: "DataHaven Testnet",
    rpcUrl: "https://services.datahaven-testnet.network/testnet",
    wssUrl: "wss://services.datahaven-testnet.network/testnet",
    mspUrl: "https://services.datahaven-testnet.network/msp",
  },
} as const;

export type NetworkKey = keyof typeof NETWORKS;
