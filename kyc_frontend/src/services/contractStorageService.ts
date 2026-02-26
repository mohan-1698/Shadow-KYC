/**
 * ZKProofStorage Contract Service
 *
 * Handles storing and retrieving groth16 ZK proofs on Sepolia testnet.
 * Contract function: storeProof(uint[3], uint[2][3], uint[3], uint256[3], bytes32, uint256, string, string)
 */

import { ethers } from "ethers";

// ─── Contract config ────────────────────────────────────────────────────────

/** TODO: replace with deployed ZKProofStorage address on Sepolia */
export const ZK_STORAGE_ADDRESS = "0xfD48b84220A945a95E6dFeF71e257B8b96D24696";

export const SEPOLIA_CHAIN_ID = 11155111;

// ─── ABI ────────────────────────────────────────────────────────────────────

export const ZK_STORAGE_ABI = [
  {
    inputs: [],
    name: "getMyProof",
    outputs: [
      {
        components: [
          {
            internalType: "uint256[2]",
            name: "pi_a",
            type: "uint256[2]",
          },
          {
            internalType: "uint256[2][2]",
            name: "pi_b",
            type: "uint256[2][2]",
          },
          {
            internalType: "uint256[2]",
            name: "pi_c",
            type: "uint256[2]",
          },
          {
            internalType: "uint256[3]",
            name: "publicSignals",
            type: "uint256[3]",
          },
          {
            internalType: "bytes32",
            name: "credentialHash",
            type: "bytes32",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
          {
            internalType: "string",
            name: "algorithm",
            type: "string",
          },
          {
            internalType: "string",
            name: "curve",
            type: "string",
          },
          {
            internalType: "bool",
            name: "exists",
            type: "bool",
          },
        ],
        internalType: "struct ZKProofStorage.ZKProof",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256[3]",
        name: "_pi_a_full",
        type: "uint256[3]",
      },
      {
        internalType: "uint256[2][3]",
        name: "_pi_b_full",
        type: "uint256[2][3]",
      },
      {
        internalType: "uint256[3]",
        name: "_pi_c_full",
        type: "uint256[3]",
      },
      {
        internalType: "uint256[3]",
        name: "_publicSignals",
        type: "uint256[3]",
      },
      {
        internalType: "bytes32",
        name: "_credentialHash",
        type: "bytes32",
      },
      {
        internalType: "uint256",
        name: "_timestamp",
        type: "uint256",
      },
      {
        internalType: "string",
        name: "_algorithm",
        type: "string",
      },
      {
        internalType: "string",
        name: "_curve",
        type: "string",
      },
    ],
    name: "storeProof",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "userProofs",
    outputs: [
      {
        internalType: "bytes32",
        name: "credentialHash",
        type: "bytes32",
      },
      {
        internalType: "uint256",
        name: "timestamp",
        type: "uint256",
      },
      {
        internalType: "string",
        name: "algorithm",
        type: "string",
      },
      {
        internalType: "string",
        name: "curve",
        type: "string",
      },
      {
        internalType: "bool",
        name: "exists",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Full projective proof coordinates as returned by snarkjs groth16.
 *   pi_a  → [x, y, "1"]        → uint256[3]
 *   pi_b  → [[x1,y1],[x2,y2],[x3,y3]] → uint256[2][3]  (3 pairs)
 *   pi_c  → [x, y, "1"]        → uint256[3]
 */
export interface StorageProofInput {
  pi_a_full: [string, string, string]; // uint256[3]
  pi_b_full: [[string, string], [string, string], [string, string]]; // uint256[2][3]
  pi_c_full: [string, string, string]; // uint256[3]
  publicSignals: [string, string, string]; // uint256[3]
  credentialHash: string; // bytes32 hex string
  timestamp?: number; // unix seconds (defaults to now)
  algorithm?: string; // e.g. "groth16"
  curve?: string; // e.g. "bn128"
}

export interface StorageProofResult {
  txHash: string;
  blockNumber?: number;
}

export interface StoredProof {
  pi_a: [string, string];
  pi_b: [[string, string], [string, string]];
  pi_c: [string, string];
  publicSignals: [string, string, string];
  credentialHash: string;
  timestamp: number;
  algorithm: string;
  curve: string;
  exists: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Convert a snarkjs pi_b (array of 3 pairs) into the on-chain uint256[2][3]
 * format for the ZKProofStorage contract.
 *
 * Swap rule (matches BN128 G2 point encoding):
 *   pair[0]: [x, y]  →  [y, x]   (swap)
 *   pair[1]: [x, y]  →  [y, x]   (swap)
 *   pair[2]: ["1","0"] →  ["1","0"] (keep — projective homogeneous coord)
 *
 * snarkjs layout:  [[x0,y0], [x1,y1], ["1","0"]]
 * on-chain layout: [[y0,x0], [y1,x1], ["1","0"]]
 */
export function swapPiB(
  pB: string[][],
): [[string, string], [string, string], [string, string]] {
  // Guard: snarkjs sometimes omits the projective row — default to ["1","0"]
  const row2: [string, string] = pB[2] ? [pB[2][0], pB[2][1]] : ["1", "0"];
  return [
    [pB[0][1], pB[0][0]], // pair[0]: swap [x,y] → [y,x]
    [pB[1][1], pB[1][0]], // pair[1]: swap [x,y] → [y,x]
    row2,                  // pair[2]: keep as-is ["1","0"]
  ];
}

/**
 * Build a StorageProofInput from the raw snarkjs groth16 proof object.
 *
 * @param proof       snarkjs proof  { pi_a, pi_b, pi_c, protocol, curve }
 * @param publicSigs  snarkjs publicSignals string[3]
 * @param credHash    bytes32 credential hash (0x-prefixed hex)
 */
export function buildStorageInput(
  proof: {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
    protocol?: string;
    curve?: string;
  },
  publicSigs: string[],
  credHash: string,
): StorageProofInput {
  return {
    pi_a_full: [proof.pi_a[0], proof.pi_a[1], proof.pi_a[2] ?? "1"],
    pi_b_full: swapPiB(proof.pi_b),
    pi_c_full: [proof.pi_c[0], proof.pi_c[1], proof.pi_c[2] ?? "1"],
    publicSignals: [publicSigs[0], publicSigs[1], publicSigs[2]],
    credentialHash: credHash,
    algorithm: proof.protocol ?? "groth16",
    curve: proof.curve ?? "bn128",
  };
}

/**
 * Build verifier inputs (for Groth16Verifier.verifyProof) from the report zkProof structure.
 *
 * The verifier takes:
 *   _pA  : uint256[2]   → pi_a[0], pi_a[1]  (drop projective "1")
 *   _pB  : uint256[2][2]→ [[pi_b[0][1], pi_b[0][0]], [pi_b[1][1], pi_b[1][0]]]  (swap + 2 pairs only)
 *   _pC  : uint256[2]   → pi_c[0], pi_c[1]  (drop projective "1")
 *   _pubSignals: uint256[3]
 */
export function buildVerifierInput(reportZkProof: {
  proof: {
    proof: { pi_a: string[]; pi_b: string[][]; pi_c: string[] };
  };
  publicSignals: { publicSignals: string[] };
}): {
  pA: [string, string];
  pB: [[string, string], [string, string]];
  pC: [string, string];
  pubSignals: [string, string, string];
} {
  const { pi_a, pi_b, pi_c } = reportZkProof.proof.proof;
  const sigs = reportZkProof.publicSignals.publicSignals;
  return {
    pA: [pi_a[0], pi_a[1]],
    pB: [
      [pi_b[0][1], pi_b[0][0]], // pair[0]: swap [x,y] → [y,x]
      [pi_b[1][1], pi_b[1][0]], // pair[1]: swap [x,y] → [y,x]
    ],
    pC: [pi_c[0], pi_c[1]],
    pubSignals: [sigs[0], sigs[1], sigs[2]],
  };
}

/**
 * Transform the full zkProof structure from the KYC verification report JSON
 * into a StorageProofInput ready to send to ZKProofStorage.storeProof().
 *
 * Handles the nested report shape:
 *   zkProof.proof.proof  → pi_a, pi_b, pi_c
 *   zkProof.proof.credentialHash (decimal string → padded bytes32 hex)
 *   zkProof.publicSignals.publicSignals → string[3]
 *
 * pi_b swap rule applied:
 *   pair[0]: [x, y] → [y, x]
 *   pair[1]: [x, y] → [y, x]
 *   pair[2]: ["1","0"] → ["1","0"]  (kept as-is)
 */
export function transformProofFromReport(reportZkProof: {
  proof: {
    proof: {
      pi_a: string[];
      pi_b: string[][];
      pi_c: string[];
      protocol?: string;
      curve?: string;
    };
    credentialHash: string;
    timestamp?: string;
    algorithm?: string;
    curve?: string;
  };
  publicSignals: { publicSignals: string[] };
}): StorageProofInput {
  const {
    proof: inner,
    credentialHash,
    algorithm,
    curve,
  } = reportZkProof.proof;
  const publicSigs = reportZkProof.publicSignals.publicSignals;

  // credentialHash from the report is a decimal BigInt string — convert to 0x bytes32 hex
  let credHash = credentialHash;
  if (!credHash.startsWith("0x")) {
    const hex = BigInt(credHash).toString(16);
    credHash = "0x" + hex.padStart(64, "0");
  }

  return {
    pi_a_full: [inner.pi_a[0], inner.pi_a[1], inner.pi_a[2] ?? "1"],
    pi_b_full: swapPiB(inner.pi_b),
    pi_c_full: [inner.pi_c[0], inner.pi_c[1], inner.pi_c[2] ?? "1"],
    publicSignals: [publicSigs[0], publicSigs[1], publicSigs[2]],
    credentialHash: credHash,
    algorithm: algorithm ?? inner.protocol ?? "groth16",
    curve: curve ?? inner.curve ?? "bn128",
  };
}

// ─── Contract calls ──────────────────────────────────────────────────────────

/**
 * Get an ethers Signer connected to the Sepolia network.
 * Requests MetaMask account access and switches the wallet to Sepolia if needed.
 * Safe to call inside any async handler — throws with a human-readable message.
 */
export async function getSepoliaSigner(): Promise<ethers.Signer> {
  if (typeof window === "undefined" || !(window as any).ethereum) {
    throw new Error(
      "MetaMask not found. Please install MetaMask to sign transactions.",
    );
  }
  const ethereum = (window as any).ethereum;

  // Request account access
  await ethereum.request({ method: "eth_requestAccounts" });

  // Switch to / add Sepolia
  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0xaa36a7" }],
    });
  } catch (e: any) {
    if (e?.code === 4902) {
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: "0xaa36a7",
            chainName: "Sepolia Testnet",
            nativeCurrency: {
              name: "Sepolia ETH",
              symbol: "ETH",
              decimals: 18,
            },
            rpcUrls: ["https://rpc.sepolia.org"],
            blockExplorerUrls: ["https://sepolia.etherscan.io"],
          },
        ],
      });
    } else {
      throw new Error("Please switch MetaMask to Sepolia testnet.");
    }
  }

  const provider = new ethers.providers.Web3Provider(ethereum);
  return provider.getSigner();
}

/**
 * Store a groth16 ZK proof on Sepolia via ZKProofStorage.storeProof().
 * Requires a connected signer (MetaMask wallet).
 */
export async function storeProofOnChain(
  signer: ethers.Signer,
  input: StorageProofInput,
): Promise<StorageProofResult> {
  const contract = new ethers.Contract(
    ZK_STORAGE_ADDRESS,
    ZK_STORAGE_ABI,
    signer,
  );

  const timestamp = input.timestamp ?? Math.floor(Date.now() / 1000);
  const algorithm = input.algorithm ?? "groth16";
  const curve = input.curve ?? "bn128";

  // Ensure credentialHash is a 0x-prefixed 32-byte (64 hex char) value.
  // MUST left-pad (padStart) — bytes32 is right-aligned in the EVM.
  let credHash = input.credentialHash;
  if (!credHash.startsWith("0x")) {
    credHash = "0x" + credHash;
  }
  if (credHash.length < 66) {
    // Strip 0x, left-pad the hex digits to 64 chars, re-add 0x
    credHash = "0x" + credHash.slice(2).padStart(64, "0");
  }

  console.log("📦 Storing proof on Sepolia...");
  console.log("pi_a_full:", input.pi_a_full);
  console.log("pi_b_full:", input.pi_b_full);
  console.log("pi_c_full:", input.pi_c_full);
  console.log("publicSignals:", input.publicSignals);
  console.log("credentialHash:", credHash);
  console.log("timestamp:", timestamp);
  console.log("algorithm:", algorithm, "| curve:", curve);

  const tx = await contract.storeProof(
    input.pi_a_full,
    input.pi_b_full,
    input.pi_c_full,
    input.publicSignals,
    credHash,
    timestamp,
    algorithm,
    curve,
  );

  console.log("⏳ Waiting for confirmation, tx:", tx.hash);
  const receipt = await tx.wait();
  console.log("✅ Proof stored at block:", receipt.blockNumber);

  return { txHash: tx.hash, blockNumber: receipt.blockNumber };
}

/**
 * Retrieve the stored proof for the currently connected wallet.
 *
 * IMPORTANT: Must pass a Signer (not a plain provider) because the contract
 * reads msg.sender internally. Calling getMyProof() through a provider-only
 * instance sets msg.sender = address(0) and returns an empty/wrong proof.
 */
export async function getMyProofFromChain(
  signer: ethers.Signer,
): Promise<StoredProof | null> {
  const contract = new ethers.Contract(
    ZK_STORAGE_ADDRESS,
    ZK_STORAGE_ABI,
    signer,
  );
  const result = await contract.getMyProof();

  if (!result.exists) return null;

  return {
    pi_a: [result.pi_a[0].toString(), result.pi_a[1].toString()],
    pi_b: [
      [result.pi_b[0][0].toString(), result.pi_b[0][1].toString()],
      [result.pi_b[1][0].toString(), result.pi_b[1][1].toString()],
    ],
    pi_c: [result.pi_c[0].toString(), result.pi_c[1].toString()],
    publicSignals: [
      result.publicSignals[0].toString(),
      result.publicSignals[1].toString(),
      result.publicSignals[2].toString(),
    ],
    credentialHash: result.credentialHash,
    timestamp: result.timestamp.toNumber(),
    algorithm: result.algorithm,
    curve: result.curve,
    exists: result.exists,
  };
}
