/**
 * File operations for the DataHaven Testnet (StorageHub).
 *
 * Upload / download / list / delete files inside a bucket on the MSP.
 * The wallet must already be switched to DataHaven before calling these.
 */

import { getConnectedAddress } from "./clientService";
import { NETWORKS } from "./networks";

// ── Types ───────────────────────────────────────────────────────────────

export interface StorageFileInfo {
  fileKey: string;
  fileName: string;
  size: number;
  contentType: string;
  uploadedAt?: string;
}

export interface FileListResponse {
  files: StorageFileInfo[];
}

// ── MSP helpers ─────────────────────────────────────────────────────────

function mspUrl(path: string): string {
  return `${NETWORKS.dataHaven.mspUrl}${path}`;
}

async function mspFetch(path: string, opts: RequestInit = {}): Promise<Response> {
  const address = getConnectedAddress();
  const headers: Record<string, string> = {
    ...(opts.headers as Record<string, string>),
  };
  if (address) {
    headers["X-Wallet-Address"] = address;
  }
  // Don't set Content-Type for FormData uploads
  if (!(opts.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  return fetch(mspUrl(path), { ...opts, headers });
}

// ── File CRUD ───────────────────────────────────────────────────────────

/**
 * Upload a file (as raw JSON text) into a bucket.
 */
export async function uploadFile(
  bucketId: string,
  fileName: string,
  content: string | Blob
): Promise<{ fileKey: string }> {
  const address = getConnectedAddress();
  if (!address) throw new Error("Wallet not connected");

  const formData = new FormData();
  const blob =
    typeof content === "string"
      ? new Blob([content], { type: "application/json" })
      : content;
  formData.append("file", blob, fileName);
  formData.append("bucketId", bucketId);
  formData.append("owner", address);

  const res = await mspFetch(`/buckets/${bucketId}/files`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`uploadFile failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return { fileKey: data.fileKey ?? data.id ?? fileName };
}

/**
 * List files inside a bucket.
 */
export async function listFiles(bucketId: string): Promise<FileListResponse> {
  try {
    const res = await mspFetch(`/buckets/${bucketId}/files`, { method: "GET" });
    if (!res.ok) return { files: [] };
    return (await res.json()) as FileListResponse;
  } catch {
    return { files: [] };
  }
}

/**
 * Get metadata for a single file.
 */
export async function getFileInfo(
  bucketId: string,
  fileKey: string
): Promise<StorageFileInfo | null> {
  try {
    const res = await mspFetch(`/buckets/${bucketId}/files/${fileKey}`, {
      method: "GET",
    });
    if (!res.ok) return null;
    return (await res.json()) as StorageFileInfo;
  } catch {
    return null;
  }
}

/**
 * Download a file as a Blob.
 */
export async function downloadFile(
  bucketId: string,
  fileKey: string
): Promise<Blob> {
  const res = await mspFetch(`/buckets/${bucketId}/files/${fileKey}/download`, {
    method: "GET",
  });
  if (!res.ok) {
    throw new Error(`downloadFile failed: ${res.status}`);
  }
  return res.blob();
}

/**
 * Delete a file from a bucket.
 */
export async function deleteFile(
  bucketId: string,
  fileKey: string
): Promise<boolean> {
  const res = await mspFetch(`/buckets/${bucketId}/files/${fileKey}`, {
    method: "DELETE",
  });
  return res.ok;
}
