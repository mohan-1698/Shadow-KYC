/**
 * clientService.ts - DataHaven StorageHub SDK Client Initialization
 *
 * Connects to user's MetaMask wallet and initializes DataHaven clients.
 * Automatically detects and connects to MetaMask in the background.
 *
 * Following official DataHaven SDK documentation:
 * https://docs.datahaven.xyz/store-and-retrieve-data/use-storagehub-sdk/get-started/
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  custom,
  type WalletClient,
  type Account,
} from 'viem';
import { StorageHubClient } from '@storagehub-sdk/core';
import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';
import { types } from '@storagehub/types-bundle';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import { NETWORK, chain } from './networks';

// ────────────────────────────────────────────────────────────────────────────
// MetaMask Wallet Detection & Connection
// ────────────────────────────────────────────────────────────────────────────

let connectedAddress: string | null = null;
let walletClient: WalletClient | null = null;
let publicClient = createPublicClient({
  chain,
  transport: http(NETWORK.rpcUrl),
});

/**
 * Detect and connect to MetaMask wallet.
 * Called automatically on app load.
 */
async function initializeEthereumConnection(): Promise<{
  address: string;
  walletClient: WalletClient;
  publicClient: typeof publicClient;
} | null> {
  // Check if MetaMask is installed
  if (!window.ethereum) {
    console.warn('[CLIENT] MetaMask not detected. Please install MetaMask to use this app.');
    return null;
  }

  try {
    // Request wallet access
    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts',
    }) as string[];

    if (!accounts || accounts.length === 0) {
      throw new Error('No wallet accounts available');
    }

    const userAddress = accounts[0];
    connectedAddress = userAddress;

    console.log('[CLIENT] Connected to MetaMask wallet:', userAddress);

    // Create wallet client that uses MetaMask provider
    const wallet: WalletClient = createWalletClient({
      chain,
      transport: custom({
        async request(request) {
          return window.ethereum!.request(request as any) as Promise<any>;
        },
      }),
    });

    walletClient = wallet;

    return {
      address: userAddress,
      walletClient: wallet,
      publicClient,
    };
  } catch (error) {
    console.error('[CLIENT] Failed to connect MetaMask:', error);
    return null;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Initialize StorageHub Client (SDK wrapper for precompiles)
// ────────────────────────────────────────────────────────────────────────────

let storageHubClient: StorageHubClient | null = null;

async function initializeStorageHubClient() {
  if (!walletClient) {
    throw new Error('[CLIENT] Wallet client not initialized. Connect MetaMask first.');
  }

  storageHubClient = new StorageHubClient({
    rpcUrl: NETWORK.rpcUrl,
    chain: chain,
    walletClient: walletClient,
    filesystemContractAddress: NETWORK.filesystemContractAddress,
  });

  return storageHubClient;
}

// ────────────────────────────────────────────────────────────────────────────
// Initialize Substrate Path (Polkadot.js)
// ────────────────────────────────────────────────────────────────────────────

await cryptoWaitReady();

const provider = new WsProvider(NETWORK.wsUrl);
const polkadotApi: ApiPromise = await ApiPromise.create({
  provider,
  typesBundle: types,
  noInitWarn: true,
});

// Note: Substrate signer would be the same wallet address derived from Ethereum
// For now, we'll use the Ethereum address as the Polkadot account

// ────────────────────────────────────────────────────────────────────────────
// Frontend Wallet Connection Helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Get the currently connected wallet address.
 * Returns null if wallet not connected.
 */
export function getConnectedAddress(): string | null {
  return connectedAddress;
}

/**
 * Connect to MetaMask wallet.
 * Called automatically or when user clicks "Connect Wallet" button.
 */
export async function connectWallet(): Promise<string> {
  const result = await initializeEthereumConnection();
  if (!result) {
    throw new Error('Failed to connect MetaMask wallet');
  }

  await initializeStorageHubClient();
  return result.address;
}

/**
 * Disconnect wallet (clears cached address).
 */
export function disconnectWallet(): void {
  connectedAddress = null;
  walletClient = null;
  storageHubClient = null;
  console.log('[CLIENT] Wallet disconnected');
}

/**
 * Get the active wallet client (uses MetaMask).
 * Ensures wallet is connected first.
 */
export async function getWalletClient(): Promise<WalletClient> {
  if (!walletClient) {
    // Auto-connect if not already connected
    const result = await initializeEthereumConnection();
    if (!result) {
      throw new Error('MetaMask not available');
    }
  }
  return walletClient!;
}

/**
 * Get or initialize the StorageHub client.
 */
export async function getStorageHubClient(): Promise<StorageHubClient> {
  if (!storageHubClient) {
    await initializeStorageHubClient();
  }
  return storageHubClient!;
}

/**
 * Get the public client for reading state.
 */
export function getPublicClient() {
  return publicClient;
}

/**
 * Get the Polkadot API instance.
 */
export function getPolkadotApi() {
  return polkadotApi;
}

// ────────────────────────────────────────────────────────────────────────────
// Auto-initialize on app load
// ────────────────────────────────────────────────────────────────────────────

/**
 * Initialize wallet connection on app startup.
 * This happens in the background without blocking the app.
 */
export async function initializeApp(): Promise<void> {
  try {
    // Try to auto-connect if MetaMask is available
    if (window.ethereum) {
      const result = await initializeEthereumConnection();
      if (result) {
        console.log('[CLIENT] Auto-connected to MetaMask:', result.address);
        try {
          // Also initialize StorageHub if wallet is connected
          await initializeStorageHubClient();
        } catch (err) {
          console.warn('[CLIENT] StorageHub client init deferred:', err);
        }
      }
    }
  } catch (error) {
    // Non-blocking - user can still use the app, just needs to connect wallet
    console.log('[CLIENT] App initialized (wallet connection optional)');
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Exports
// ────────────────────────────────────────────────────────────────────────────

export {
  connectedAddress as address,
  publicClient,
  polkadotApi,
  getStorageHubClient as storageHubClient,
};
