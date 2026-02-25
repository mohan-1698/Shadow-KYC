import { Chain, defineChain } from 'viem';
import { sepolia } from 'viem/chains';

// Re-export the built-in Sepolia chain from viem
export { sepolia };

/**
 * DataHaven (StorageHub) Testnet — Chain ID 55931
 * Used exclusively for bucket / file storage after ZK proof is complete.
 */
export const dataHavenTestnet = defineChain({
  id: 55931,
  name: 'DataHaven Testnet',
  nativeCurrency: {
    name: 'Mock',
    symbol: 'MOCK',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://services.datahaven-testnet.network/testnet'],
      webSocket: ['wss://services.datahaven-testnet.network/testnet'],
    },
  },
  testnet: true,
});

/**
 * Network configuration following official DataHaven SDK documentation
 */
export const NETWORKS = {
  testnet: {
    id: 55931,
    name: 'DataHaven Testnet',
    rpcUrl: 'https://services.datahaven-testnet.network/testnet',
    wsUrl: 'wss://services.datahaven-testnet.network/testnet',
    mspUrl: 'https://deo-dh-backend.testnet.datahaven-infra.network/',
    nativeCurrency: { name: 'Mock', symbol: 'MOCK', decimals: 18 },
    filesystemContractAddress:
      '0x0000000000000000000000000000000000000404' as `0x${string}`,
  },
};

export const NETWORK = NETWORKS.testnet;

// Define chain using official pattern
export const chain: Chain = defineChain({
  id: NETWORK.id,
  name: NETWORK.name,
  nativeCurrency: NETWORK.nativeCurrency,
  rpcUrls: { default: { http: [NETWORK.rpcUrl], webSocket: [NETWORK.wsUrl] } },
});
