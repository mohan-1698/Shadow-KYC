/**
 * mspService.ts - MSP (Main Storage Provider) Client Service
 *
 * Establishes connection to DataHaven's Main Storage Provider (MSP) backend
 * for storage operations like buckets and file management.
 *
 * Uses the user's connected MetaMask wallet for SIWE authentication.
 *
 * Following official DataHaven SDK documentation:
 * https://docs.datahaven.xyz/store-and-retrieve-data/use-storagehub-sdk/get-started/#set-up-msp-service
 */

import {
  HealthStatus,
  InfoResponse,
  MspClient,
  UserInfo,
} from '@storagehub-sdk/msp-client';
import type { HttpClientConfig } from '@storagehub-sdk/core';
import { getConnectedAddress, getWalletClient } from './clientService';
import { NETWORK } from './networks';

// ────────────────────────────────────────────────────────────────────────────
// Configuration & Session State
// ────────────────────────────────────────────────────────────────────────────

// Configure the HTTP client to point to the MSP backend
const httpCfg: HttpClientConfig = { baseUrl: NETWORK.mspUrl };

// Initialize a session token for authenticated requests (updated after authentication
// through SIWE)
let sessionToken: string | undefined = undefined;

// MSP Client instance
let mspClient: MspClient | null = null;

// ────────────────────────────────────────────────────────────────────────────
// Session Provider
// ────────────────────────────────────────────────────────────────────────────

/**
 * Provide session information to the MSP client whenever available.
 * Returns a token and user address if authenticated, otherwise undefined.
 */
const sessionProvider = async () => {
  const address = getConnectedAddress();
  return sessionToken && address
    ? ({ token: sessionToken, user: { address } } as const)
    : undefined;
};

// ────────────────────────────────────────────────────────────────────────────
// MSP Client Initialization
// ────────────────────────────────────────────────────────────────────────────

/**
 * Initialize the MSP client connection.
 * Called lazily when first needed.
 */
async function initializeMspClient(): Promise<MspClient> {
  if (mspClient) {
    return mspClient;
  }

  mspClient = await MspClient.connect(httpCfg, sessionProvider);
  console.log('[MSP] Client initialized and connected');

  return mspClient;
}

/**
 * Get or create the MSP client.
 */
export async function getMspClient(): Promise<MspClient> {
  if (!mspClient) {
    await initializeMspClient();
  }
  return mspClient!;
}

// ────────────────────────────────────────────────────────────────────────────
// MSP Operations
// ────────────────────────────────────────────────────────────────────────────

/**
 * Retrieve MSP metadata, including its unique ID and version.
 * Used to get MSP info for storage operations.
 */
export const getMspInfo = async (): Promise<InfoResponse> => {
  const client = await getMspClient();
  const mspInfo = await client.info.getInfo();
  console.log(`[MSP] ID: ${mspInfo.mspId}`);
  return mspInfo;
};

/**
 * Retrieve and log the MSP's current health status.
 * Useful for checking if the storage provider is operational.
 */
export const getMspHealth = async (): Promise<HealthStatus> => {
  const client = await getMspClient();
  const mspHealth = await client.info.getHealth();
  console.log(`[MSP] Health: ${JSON.stringify(mspHealth)}`);
  return mspHealth;
};

/**
 * Authenticate the user via SIWE (Sign-In With Ethereum) using the connected MetaMask wallet.
 * Once authenticated, stores the returned session token and retrieves the user's profile.
 */
export const authenticateUser = async (): Promise<UserInfo> => {
  console.log('[MSP] Authenticating user with MSP via SIWE...');

  const walletClient = await getWalletClient();
  const address = getConnectedAddress();

  if (!address) {
    throw new Error('[MSP] Wallet not connected. Please connect MetaMask first.');
  }

  // In development, domain and uri can be arbitrary placeholders,
  // but in production, they must match your actual frontend origin.
  const domain = window.location.hostname || 'localhost';
  const uri = window.location.origin || 'http://localhost';

  const client = await getMspClient();
  const siweSession = await client.auth.SIWE(walletClient, domain, uri);
  console.log('[MSP] SIWE Session:', siweSession);
  sessionToken = (siweSession as { token: string }).token;

  const profile: UserInfo = await client.auth.getProfile();
  console.log('[MSP] User Profile:', profile);
  return profile;
};

/**
 * Clear the session token (logout).
 * 
 * Clears the cached session token so the next operation will require re-authentication.
 */
export const clearSession = (): void => {
  console.log('[MSP] Clearing session token');
  sessionToken = undefined;
};

// ────────────────────────────────────────────────────────────────────────────
// Export MSP Client getter for direct access
// ────────────────────────────────────────────────────────────────────────────

// For backward compatibility, export a promise that resolves to the client
export { getMspClient as mspClient };
