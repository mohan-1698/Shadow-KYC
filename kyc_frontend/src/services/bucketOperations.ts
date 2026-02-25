/**
 * Bucket operations for the DataHaven Testnet (StorageHub).
 *
 * Using official DataHaven StorageHub SDK for bucket management.
 * Note: Bucket CREATION is handled via the StorageHub smart contract (precompile),
 * not via MSP. This module handles listing and retrieving existing buckets.
 *
 * https://docs.datahaven.xyz/store-and-retrieve-data/use-storagehub-sdk/get-started/
 *
 * ⚠️  IMPORTANT: These functions require prior SIWE authentication!
 * Before calling any function here:
 *   1. Call authenticateUser() in mspService.ts to establish SIWE session
 *   2. Ensure wallet is switched to DataHaven Testnet (Chain ID 55931)
 *
 * All operations use mspClient from mspService.ts, which automatically
 * handles session management and authentication headers.
 *
 * See storageService.ts for the complete automated workflow that handles
 * network switching, MSP connection, SIWE auth, and file upload.
 */

import { getMspClient } from "./mspService";
import type { Bucket } from "@storagehub-sdk/msp-client";
import { getConnectedAddress } from "./clientService";

// ────────────────────────────────────────────────────────────────────────────
// Bucket Querying Operations (Retrieval only - creation is on-chain)
// ────────────────────────────────────────────────────────────────────────────

/**
 * List all buckets accessible by the authenticated user.
 *
 * Note: For a hackathon/quick setup, you may want to create buckets manually
 * via the DataHaven dApp (https://app.datahaven.xyz/) instead of on-chain transactions.
 *
 * @returns Array of buckets available to the user
 */
export async function listBuckets(): Promise<Bucket[]> {
  try {
    console.log("[BUCKET] Listing accessible buckets for user");
    const msp = await getMspClient();
    const buckets = await msp.buckets.listBuckets();
    console.log(`[BUCKET] Found ${buckets.length} bucket(s)`);
    return buckets;
  } catch (err) {
    console.error("[BUCKET] listBuckets error:", err);
    return [];
  }
}

/**
 * Get a single bucket by ID.
 *
 * @param bucketId - The ID of the bucket to retrieve
 * @returns The bucket object, or null if not found
 */
export async function getBucket(bucketId: string): Promise<Bucket | null> {
  try {
    console.log(`[BUCKET] Getting bucket: ${bucketId}`);
    const msp = await getMspClient();
    const bucket = await msp.buckets.getBucket(bucketId);
    console.log(`[BUCKET] Retrieved bucket: ${bucket.name}`);
    return bucket;
  } catch (err) {
    console.warn(
      `[BUCKET] getBucket error for ${bucketId} (bucket may not exist):`,
      err
    );
    return null;
  }
}

/**
 * Get files/folders under a specific path in a bucket.
 *
 * Note: For retrieving files, use fileOperations.listFiles() instead.
 *
 * @param bucketId - The ID of the bucket
 * @param path - Optional path within the bucket (defaults to root)
 * @returns File and folder tree for the specified path
 */
export async function getBucketFiles(
  bucketId: string,
  path?: string
): Promise<any> {
  try {
    console.log(`[BUCKET] Getting files for bucket ${bucketId} at path: ${path || "/"}`);
    const msp = await getMspClient();
    const fileList = await msp.buckets.getFiles(bucketId, { path });
    console.log(
      `[BUCKET] Retrieved file tree with ${fileList.files.length} item(s)`
    );
    return fileList;
  } catch (err) {
    console.error(`[BUCKET] getBucketFiles error:`, err);
    throw new Error(`Failed to get bucket files: ${String(err)}`);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Bucket Creation (On-Chain via StorageHub Smart Contract)
// ────────────────────────────────────────────────────────────────────────────

/**
 * NOTE: Bucket creation requires on-chain transactions via the StorageHub smart contract.
 *
 * For a hackathon setup, consider these alternatives:
 * 1. **Use the DataHaven dApp** (https://app.datahaven.xyz/) to manually create buckets
 * 2. **Use storageHubClient** from clientService.ts to call the FileSystem precompile
 * 3. **Skip bucket creation** and store files directly using fileOperations.uploadFile()
 *    (if the MSP supports direct file uploads without explicit buckets)
 *
 * Example using storageHubClient (not implemented here for simplicity):
 * ```typescript
 * import { storageHubClient } from "./clientService.ts";
 * await storageHubClient.createBucket(bucketName, false);
 * ```
 *
 * This function is a placeholder to indicate that bucket creation happens on-chain.
 */
export async function createBucket(
  bucketName: string,
  isPrivate: boolean = true
): Promise<string> {
  throw new Error(
    "Bucket creation is not available via MSP client. " +
      "Use the DataHaven dApp (https://app.datahaven.xyz/) to create buckets, " +
      "or use storageHubClient.createBucket() for on-chain bucket creation."
  );
}

/**
 * NOTE: Bucket deletion requires on-chain transactions via the StorageHub smart contract.
 * This function is not available via MSP.
 */
export async function deleteBucket(bucketId: string): Promise<boolean> {
  throw new Error(
    "Bucket deletion is not available via MSP client. " +
      "Use the DataHaven dApp (https://app.datahaven.xyz/), " +
      "or use storageHubClient.deleteBucket() for on-chain bucket deletion."
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ────────────────────────────────────────────────────────────────────────────

/**
 * Generate a deterministic bucket name for a given wallet address.
 *
 * Format: `kyc-{cleanAddress}`
 * Example: `kyc-0xabc123...`
 *
 * @param walletAddress - The wallet address (with or without 0x prefix)
 * @returns A filesystem-friendly bucket name
 */
export function walletBucketName(walletAddress: string): string {
  const cleanAddress = walletAddress.toLowerCase().replace(/^0x/, "");
  return `kyc-${cleanAddress}`;
}

/**
 * IMPORTANT: For hackathon setup instructions, see comments above.
 *
 * This module assumes buckets are pre-created via the dApp or have been
 * created on-chain using storageHubClient. File storage then happens
 * via the MSP (mspClient.files.*) after SIWE authentication.
 */
