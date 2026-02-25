/**
 * Bucket operations for the DataHaven Testnet (StorageHub).
 *
 * These wrappers call the MSP API on the DataHaven testnet to manage
 * buckets that store KYC extracted data.  The wallet must already be
 * switched to DataHaven before calling any function here.
 */

import { getConnectedAddress, getPublicClient } from "./clientService";
import { NETWORKS } from "./networks";

// ── Types ───────────────────────────────────────────────────────────────

export interface Bucket {
  id: string;
  name: string;
  owner: string;
  isPrivate: boolean;
  createdAt?: string;
}

// ── MSP helpers (lightweight – no SDK dependency) ───────────────────────

function mspUrl(path: string): string {
  return `${NETWORKS.dataHaven.mspUrl}${path}`;
}

async function mspFetch(path: string, opts: RequestInit = {}): Promise<Response> {
  const address = getConnectedAddress();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string>),
  };
  if (address) {
    headers["X-Wallet-Address"] = address;
  }
  return fetch(mspUrl(path), { ...opts, headers });
}

// ── Bucket CRUD ─────────────────────────────────────────────────────────

/**
 * List all buckets owned by the connected wallet.
 */
export async function listBuckets(): Promise<Bucket[]> {
  try {
    const res = await mspFetch("/buckets", { method: "GET" });
    if (!res.ok) throw new Error(`listBuckets failed: ${res.status}`);
    return (await res.json()) as Bucket[];
  } catch (err) {
    console.warn("listBuckets error (MSP may not be available):", err);
    return [];
  }
}

/**
 * Get a single bucket by id.
 */
export async function getBucket(bucketId: string): Promise<Bucket | null> {
  try {
    const res = await mspFetch(`/buckets/${bucketId}`, { method: "GET" });
    if (!res.ok) return null;
    return (await res.json()) as Bucket;
  } catch {
    return null;
  }
}

/**
 * Create a private bucket. The bucket name is the wallet address,
 * making it deterministic and unique per user.
 *
 * Returns the bucket id (which may be deterministically derived).
 */
export async function createBucket(
  bucketName: string,
  isPrivate: boolean = true
): Promise<string> {
  const address = getConnectedAddress();
  if (!address) throw new Error("Wallet not connected");

  const res = await mspFetch("/buckets", {
    method: "POST",
    body: JSON.stringify({
      name: bucketName,
      owner: address,
      isPrivate,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`createBucket failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.bucketId ?? data.id ?? bucketName;
}

/**
 * Delete a bucket (must be empty).
 */
export async function deleteBucket(bucketId: string): Promise<boolean> {
  const res = await mspFetch(`/buckets/${bucketId}`, { method: "DELETE" });
  return res.ok;
}

/**
 * Deterministic bucket name for a given wallet address.
 * We lowercase and strip the "0x" prefix to keep names filesystem-friendly.
 */
export function walletBucketName(address: string): string {
  return `kyc-${address.toLowerCase()}`;
}
