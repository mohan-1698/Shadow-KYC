/**
 * File operations for the DataHaven Testnet (StorageHub).
 *
 * Using official DataHaven StorageHub SDK for file management.
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
 * File operations via MSP require:
 * - bucketId: The bucket where the file is stored
 * - fileKey: Unique identifier for the file (usually derived from wallet + location)
 * - owner: The wallet address that owns the file
 * - location: File path within the bucket (e.g., "kyc-data.json")
 *
 * See storageService.ts for the complete automated workflow.
 */

import { getMspClient } from "./mspService";
import type { StorageFileInfo, UploadReceipt } from "@storagehub-sdk/msp-client";
import { getConnectedAddress } from "./clientService";

// ────────────────────────────────────────────────────────────────────────────
// File CRUD Operations
// ────────────────────────────────────────────────────────────────────────────

/**
 * Upload a file to a bucket via the MSP.
 *
 * Note: This function requires an existing bucket and computes the file key
 * deterministically from owner + bucketId + fileName.
 *
 * @param bucketId - The ID of the bucket where the file will be stored
 * @param fileName - The name/path of the file (e.g., "kyc-data.json")
 * @param content - The file content (string or Blob)
 * @returns An object containing the fileKey (unique file identifier)
 */
export async function uploadFile(
  bucketId: string,
  fileName: string,
  content: string | Blob
): Promise<UploadReceipt> {
  const address = getConnectedAddress();
  if (!address) {
    throw new Error("[FILE] Wallet address not available");
  }

  try {
    console.log(`[FILE] Uploading file to bucket ${bucketId}: ${fileName}`);

    // Convert string content to Blob if necessary
    const blob =
      typeof content === "string"
        ? new Blob([content], { type: "application/json" })
        : content;

    // Compute a deterministic file key from owner + location
    // For simplicity, we'll use the fileName as the fileKey
    // (In production, use a more sophisticated key derivation)
    const fileKey = `${bucketId}-${fileName}`;

    // Use SDK method with correct parameters:
    // uploadFile(bucketId, fileKey, file, owner, location, options)
    const msp = await getMspClient();
    const uploadReceipt = await msp.files.uploadFile(
      bucketId,
      fileKey,
      blob,
      address, // owner
      fileName // location
    );

    console.log(`[FILE] Successfully uploaded file with receipt:`, uploadReceipt);
    return uploadReceipt;
  } catch (err) {
    console.error(`[FILE] uploadFile error:`, err);
    throw new Error(`Failed to upload file: ${String(err)}`);
  }
}

/**
 * Get metadata for a single file.
 *
 * @param bucketId - The ID of the bucket containing the file
 * @param fileKey - The unique identifier of the file
 * @returns The file metadata, or null if not found
 */
export async function getFileInfo(
  bucketId: string,
  fileKey: string
): Promise<StorageFileInfo | null> {
  try {
    console.log(`[FILE] Getting file info: bucket ${bucketId}, file ${fileKey}`);
    const msp = await getMspClient();
    const fileInfo = await msp.files.getFileInfo(bucketId, fileKey);
    console.log(`[FILE] Retrieved file info:`, fileInfo);
    return fileInfo;
  } catch (err) {
    console.warn(`[FILE] getFileInfo error for ${fileKey}:`, err);
    return null;
  }
}

/**
 * Download a file from the MSP.
 *
 * Note: Download only requires the fileKey, not the bucketId.
 *
 * @param fileKey - The unique identifier of the file
 * @returns The file content as a ReadableStream
 */
export async function downloadFile(fileKey: string): Promise<ReadableStream<Uint8Array>> {
  try {
    console.log(`[FILE] Downloading file: ${fileKey}`);
    const msp = await getMspClient();
    const downloadResult = await msp.files.downloadFile(fileKey);
    console.log(`[FILE] Successfully initiated download for: ${fileKey}`);
    return downloadResult.stream;
  } catch (err) {
    console.error(`[FILE] downloadFile error:`, err);
    throw new Error(`Failed to download file: ${String(err)}`);
  }
}

/**
 * List files in a bucket.
 *
 * Note: Use bucketOperations.getBucketFiles() for listing instead.
 * This is a convenience wrapper that delegates to that function.
 *
 * @param bucketId - The ID of the bucket
 * @returns File tree for the bucket
 */
export async function listFiles(bucketId: string): Promise<any> {
  try {
    console.log(`[FILE] Listing files in bucket: ${bucketId}`);
    const msp = await getMspClient();
    const fileList = await msp.buckets.getFiles(bucketId);
    console.log(
      `[FILE] Found ${fileList.files.length} file(s) in bucket`
    );
    return fileList.files;
  } catch (err) {
    console.warn(`[FILE] listFiles error for bucket ${bucketId}:`, err);
    return [];
  }
}

/**
 * Delete a file from a bucket.
 *
 * Note: File deletion is not directly available via MSP client.
 * Files are typically deleted through the on-chain StorageHub contract
 * or via the DataHaven dApp.
 */
export async function deleteFile(
  bucketId: string,
  fileKey: string
): Promise<boolean> {
  throw new Error(
    "File deletion is not available via MSP client. " +
      "Use the DataHaven dApp (https://app.datahaven.xyz/) " +
      "or storageHubClient.deleteFile() for on-chain file deletion."
  );
}
