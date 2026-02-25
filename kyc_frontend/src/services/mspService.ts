import { getConnectedAddress, getWalletClient } from "./clientService";
import { NETWORKS } from "./networks";

// ── Types ───────────────────────────────────────────────────────────────

export interface UserInfo {
  address: string;
  displayName?: string;
  [key: string]: unknown;
}

export interface HttpClientConfig {
  baseUrl: string;
  headers?: Record<string, string>;
}

export interface SiweSession {
  token: string;
  user: UserInfo;
}

// ── Module-level state ──────────────────────────────────────────────────

const SESSION_TOKEN_KEY = "shadowkyc_session_token";
const USER_PROFILE_KEY = "shadowkyc_user_profile";

let sessionToken: string | null =
  sessionStorage.getItem(SESSION_TOKEN_KEY) ?? null;
let authenticatedUserProfile: UserInfo | null = (() => {
  const raw = sessionStorage.getItem(USER_PROFILE_KEY);
  return raw ? (JSON.parse(raw) as UserInfo) : null;
})();

// ── Session provider (attaches auth to every MSP request) ───────────────

/**
 * Returns auth credentials for each request, or undefined if not logged in.
 */
export const sessionProvider = async () => {
  const address = getConnectedAddress();
  return sessionToken && address
    ? { token: sessionToken, user: { address } }
    : undefined;
};

// ── MSP Connection ──────────────────────────────────────────────────────

let mspBaseUrl: string = NETWORKS.dataHaven.mspUrl;

/**
 * Helper: make an authenticated request to the MSP.
 */
async function mspFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const session = await sessionProvider();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (session?.token) {
    headers["Authorization"] = `Bearer ${session.token}`;
  }

  return fetch(`${mspBaseUrl}${path}`, {
    ...options,
    headers,
  });
}

/**
 * Connect to the MSP endpoint. This validates that the endpoint is
 * reachable and returns a thin client object.
 */
export async function connectToMsp(): Promise<{ baseUrl: string }> {
  mspBaseUrl = NETWORKS.dataHaven.mspUrl;

  // Healthcheck – if the MSP exposes a status route
  try {
    const res = await fetch(`${mspBaseUrl}/health`, { method: "GET" });
    if (!res.ok) {
      console.warn("MSP health-check returned non-OK – proceeding anyway.");
    }
  } catch {
    console.warn("MSP health-check unreachable – proceeding anyway.");
  }

  return { baseUrl: mspBaseUrl };
}

// ── SIWE Authentication ─────────────────────────────────────────────────

/**
 * Sign-In With Ethereum:
 *  1. Request a nonce / challenge from the MSP.
 *  2. Build the EIP-4361 message.
 *  3. Sign it with the user's wallet.
 *  4. Send the signed message back for verification.
 *  5. Store the resulting session token.
 */
export async function authenticateUser(): Promise<UserInfo> {
  const walletClient = getWalletClient();
  const address = getConnectedAddress();

  if (!address) {
    throw new Error("Wallet not connected. Call connectWallet() first.");
  }

  const domain = window.location.hostname;
  const uri = window.location.origin;

  // 1. Request a SIWE nonce from MSP
  let nonce: string;
  try {
    const nonceRes = await mspFetch("/auth/siwe/nonce", { method: "GET" });
    const nonceData = await nonceRes.json();
    nonce = nonceData.nonce;
  } catch {
    // If the MSP doesn't support a nonce endpoint, generate a local one
    nonce = crypto.randomUUID();
  }

  // 2. Build the EIP-4361 SIWE message
  const issuedAt = new Date().toISOString();
  const message = [
    `${domain} wants you to sign in with your Ethereum account:`,
    address,
    "",
    "Sign in to Shadow-KYC on DataHaven Testnet",
    "",
    `URI: ${uri}`,
    `Version: 1`,
    `Chain ID: ${NETWORKS.dataHaven.chainId}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join("\n");

  // 3. Sign with the wallet
  const signature = await walletClient.signMessage({
    account: address,
    message,
  });

  // 4. Send signed message to MSP for verification
  const verifyRes = await mspFetch("/auth/siwe/verify", {
    method: "POST",
    body: JSON.stringify({ message, signature }),
  });

  if (!verifyRes.ok) {
    throw new Error("SIWE verification failed – MSP rejected the signature.");
  }

  const siweSession: SiweSession = await verifyRes.json();
  sessionToken = siweSession.token;

  // 5. Fetch user profile
  let profile: UserInfo;
  try {
    const profileRes = await mspFetch("/auth/profile", { method: "GET" });
    profile = await profileRes.json();
  } catch {
    profile = { address };
  }

  authenticatedUserProfile = profile;

  // Persist to sessionStorage (survives refresh, cleared on tab close)
  sessionStorage.setItem(SESSION_TOKEN_KEY, sessionToken);
  sessionStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));

  return profile;
}

// ── Getters ─────────────────────────────────────────────────────────────

export function getSessionToken(): string | null {
  return sessionToken;
}

export function getAuthenticatedUser(): UserInfo | null {
  return authenticatedUserProfile;
}

export function isAuthenticated(): boolean {
  return !!sessionToken && !!authenticatedUserProfile;
}

/** Clear SIWE session (logout). */
export function clearSession(): void {
  sessionToken = null;
  authenticatedUserProfile = null;
  sessionStorage.removeItem(SESSION_TOKEN_KEY);
  sessionStorage.removeItem(USER_PROFILE_KEY);
}
