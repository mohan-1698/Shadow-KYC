/**
 * storageService.ts — High-level orchestrator
 *
 * After ZK proof is successfully generated on Sepolia:
 *  1. Switch wallet to DataHaven Testnet
 *  2. Create (or reuse) a private bucket named after the wallet address
 *  3. Upload the extracted Aadhaar data as a JSON file
 *  4. Switch wallet back to Sepolia
 *
 * This keeps ZK proofs on Sepolia and user details on DataHaven.
 */

import { getConnectedAddress, switchToNetwork, getCurrentNetwork } from "./clientService";
import { walletBucketName, createBucket, getBucket } from "./bucketOperations";
import { uploadFile } from "./fileOperations";

// ── Types ───────────────────────────────────────────────────────────────

export interface ExtractedKycData {
  name: string;
  dob: string;
  gender: string;
  state: string;
}

export interface StorageResult {
  bucketId: string;
  fileKey: string;
  network: string;
  timestamp: string;
}

// ── Main entry point ────────────────────────────────────────────────────

/**
 * Store KYC extracted data on the DataHaven Testnet.
 *
 * Flow:
 *  1. Remember which network we're on (should be Sepolia normally).
 *  2. Switch MetaMask to DataHaven.
 *  3. Create a private bucket  "kyc-0x<address>"  (idempotent).
 *  4. Upload `extractedData` as  `kyc-data.json`.
 *  5. Switch back to Sepolia so the rest of the app continues normally.
 *
 * @param extractedData  Aadhaar extracted fields (name, dob, gender, state)
 * @returns  bucket id + file key for reference
 */
export async function storeKycDataOnDataHaven(
  extractedData: ExtractedKycData
): Promise<StorageResult> {
  const address = getConnectedAddress();
  if (!address) throw new Error("Wallet not connected");

  const previousNetwork = getCurrentNetwork();

  try {
    // ── 1. Switch wallet to DataHaven ─────────────────────────────────
    console.log("[storageService] Switching to DataHaven Testnet…");
    await switchToNetwork("dataHaven");

    // ── 2. Create (or reuse) private bucket ───────────────────────────
    const bucketName = walletBucketName(address);
    console.log(`[storageService] Ensuring bucket "${bucketName}" exists…`);

    let bucketId: string;
    const existing = await getBucket(bucketName);
    if (existing) {
      bucketId = existing.id;
      console.log(`[storageService] Bucket already exists: ${bucketId}`);
    } else {
      bucketId = await createBucket(bucketName, /* isPrivate */ true);
      console.log(`[storageService] Bucket created: ${bucketId}`);
    }

    // ── 3. Upload extracted data ──────────────────────────────────────
    const payload = JSON.stringify(
      {
        walletAddress: address,
        extractedData,
        storedAt: new Date().toISOString(),
      },
      null,
      2
    );

    const fileName = "kyc-data.json";
    console.log(`[storageService] Uploading ${fileName} to bucket ${bucketId}…`);
    const { fileKey } = await uploadFile(bucketId, fileName, payload);
    console.log(`[storageService] File stored. fileKey = ${fileKey}`);

    return {
      bucketId,
      fileKey,
      network: "DataHaven Testnet",
      timestamp: new Date().toISOString(),
    };
  } finally {
    // ── 4. Always switch back to original network ─────────────────────
    if (previousNetwork !== "dataHaven") {
      console.log(`[storageService] Switching back to ${previousNetwork}…`);
      try {
        await switchToNetwork(previousNetwork);
      } catch (err) {
        console.warn("[storageService] Could not switch back:", err);
      }
    }
  }
}
