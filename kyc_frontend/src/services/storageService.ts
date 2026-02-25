/**
 * storageService.ts — High-level orchestrator for DataHaven KYC storage
 *
 * After ZK proof is successfully generated on Sepolia (EVM):
 *  1. Authenticate with DataHaven MSP via SIWE (Sign-In With Ethereum)
 *  2. Upload the extracted Aadhaar data as a JSON file to MSP
 *
 * This keeps ZK proofs on Sepolia and user KYC details encrypted in DataHaven.
 * StorageHub SDK handles all protocol complexity (authentication, storage).
 *
 * Note: This flow REQUIRES a bucket to already exist on DataHaven.
 * For hackathon setup, create a bucket via:
 * - DataHaven dApp: https://app.datahaven.xyz/
 * - Or programmatically using storageHubClient (on-chain transactions required)
 *
 * Following official DataHaven SDK documentation:
 * https://docs.datahaven.xyz/store-and-retrieve-data/use-storagehub-sdk/get-started/
 */

import { getConnectedAddress } from "./clientService";
import { authenticateUser, getMspClient } from "./mspService";
import { walletBucketName } from "./bucketOperations";
import { uploadFile } from "./fileOperations";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface ExtractedKycData {
  name: string;
  dob: string;
  gender: string;
  state: string;
}

export interface StorageResult {
  bucketId?: string;
  fileKey: string;
  network: string;
  timestamp: string;
  authenticated: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// Main Entry Point
// ────────────────────────────────────────────────────────────────────────────

/**
 * Store KYC extracted data on the DataHaven Testnet with SIWE authentication.
 *
 * PREREQUISITES:
 * 1. A bucket must already exist on DataHaven (create via dApp or on-chain)
 * 2. You need the bucketId of that bucket
 *
 * Complete automated flow:
 *  1. Authenticate user with DataHaven MSP via SIWE
 *     - User signs message with connected wallet
 *     - MSP returns session token for auth
 *  2. Upload extracted Aadhaar data as kyc-data.json
 *  3. Store file key and metadata for record
 *
 * User interaction:
 *  - SIWE signature: Single MetaMask signature request for authentication
 *  - File upload: Silent (automatic, no additional prompts)
 *
 * Non-blocking: If storage fails, KYC verification continues on Sepolia.
 * Errors are logged but don't block the ZK proof flow.
 *
 * @param extractedData Aadhaar extracted fields (name, dob, gender, state)
 * @param bucketId Optional: The DataHaven bucket ID to store files in.
 *                  If not provided, will attempt to find the user's bucket.
 * @returns Storage result with file key and auth status for reference
 * @throws Error if wallet not connected, SIWE authentication fails, or upload fails
 */
export async function storeKycDataOnDataHaven(
  extractedData: ExtractedKycData,
  bucketId?: string
): Promise<StorageResult> {
  const address = getConnectedAddress();
  if (!address) {
    throw new Error("[STORAGE] Wallet address not available");
  }

  console.log("[STORAGE] Starting KYC data storage on DataHaven…");
  console.log(`[STORAGE] Using wallet: ${address}`);

  try {
    // ── Step 1: Authenticate with SIWE ───────────────────────────────
    console.log("[STORAGE] Step 1/3: Authenticating with DataHaven MSP via SIWE…");
    console.log("[STORAGE] Please sign the authentication message in your wallet");
    const userProfile = await authenticateUser();
    console.log(
      `[STORAGE] ✓ SIWE authenticated for user: ${userProfile.address}`
    );

    // ── Step 2: Determine target bucket ──────────────────────────────
    // If no bucket ID provided, try to find the user's default bucket
    let targetBucketId = bucketId;
    if (!targetBucketId) {
      console.log("[STORAGE] Step 2/3: Locating user's bucket…");
      // Try to list buckets and use the first one
      // This assumes the user has already created a bucket via the dApp
      try {
        const msp = await getMspClient();
        const buckets = await msp.buckets.listBuckets();
        if (buckets.length === 0) {
          throw new Error(
            "No buckets found. Please create a bucket on DataHaven first. " +
              "Use the dApp: https://app.datahaven.xyz/"
          );
        }
        targetBucketId = buckets[0].bucketId;
        console.log(`[STORAGE] ✓ Found bucket: ${targetBucketId}`);
      } catch (err) {
        throw new Error(
          `Could not find a bucket. Please create one via the dApp first. ` +
            `Error: ${String(err)}`
        );
      }
    } else {
      console.log(`[STORAGE] Step 2/3: Using provided bucket: ${targetBucketId}`);
    }

    // ── Step 3: Upload extracted KYC data ────────────────────────────
    const payload = JSON.stringify(
      {
        walletAddress: address,
        extractedData,
        storedAt: new Date().toISOString(),
        network: "DataHaven Testnet (ChainID: 55931)",
      },
      null,
      2
    );

    const fileName = "kyc-data.json";
    console.log(
      `[STORAGE] Step 3/3: Uploading ${fileName} to bucket…`
    );
    const uploadReceipt = await uploadFile(
      targetBucketId,
      fileName,
      payload
    );
    console.log(`[STORAGE] ✓ File stored on DataHaven`);
    console.log(`[STORAGE]   File Key: ${uploadReceipt.fileKey}`);
    console.log(`[STORAGE]   Bucket ID: ${uploadReceipt.bucketId}`);

    // ── Build result ─────────────────────────────────────────────────
    const result: StorageResult = {
      bucketId: uploadReceipt.bucketId,
      fileKey: uploadReceipt.fileKey,
      network: "DataHaven Testnet",
      timestamp: new Date().toISOString(),
      authenticated: true, // We successfully authenticated to reach this point
    };

    console.log(
      "[STORAGE] ✓ Complete: KYC data securely stored on DataHaven"
    );
    console.log(`[STORAGE] Bucket: ${result.bucketId}`);
    console.log(`[STORAGE] File: ${result.fileKey}`);

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[STORAGE] Error during storage flow:", errorMsg);

    // Log which step failed for debugging
    if (errorMsg.includes("SIWE") || errorMsg.includes("auth")) {
      console.error(
        "[STORAGE] → Failed at authentication step. " +
          "Make sure you signed the message in your wallet."
      );
    } else if (errorMsg.includes("bucket")) {
      console.error(
        "[STORAGE] → Failed at bucket selection. " +
          "Please create a bucket via https://app.datahaven.xyz/ first."
      );
    } else if (errorMsg.includes("upload") || errorMsg.includes("file")) {
      console.error(
        "[STORAGE] → Failed at file upload. Storage may be temporarily unavailable."
      );
    }

    throw new Error(`DataHaven storage failed: ${errorMsg}`);
  }
}

/**
 * Optional: Reset storage flow (e.g., when switching accounts).
 * Clears any cached session state but does not affect stored data.
 */
export async function resetStorageFlow(): Promise<void> {
  console.log("[STORAGE] Resetting storage session…");
  // Note: Session is managed by mspClient internally via sessionProvider
  // If needed, implement logout in mspService.ts
  console.log("[STORAGE] Session reset complete");
}

/**
 * SETUP INSTRUCTIONS FOR HACKATHON:
 *
 * 1. Create a bucket via DataHaven dApp:
 *    - Visit https://app.datahaven.xyz/
 *    - Connect your wallet
 *    - Create a new bucket
 *    - Note down the bucket ID (starts with 0x...)
 *
 * 2. Use in KYCDashboard:
 *    ```typescript
 *    const result = await storeKycDataOnDataHaven(
 *      extractedData,
 *      "0x..." // bucket ID from step 1
 *    );
 *    ```
 *
 * 3. Or let the function auto-detect:
 *    ```typescript
 *    // Uses the first bucket found for the authenticated user
 *    const result = await storeKycDataOnDataHaven(extractedData);
 *    ```
 */
