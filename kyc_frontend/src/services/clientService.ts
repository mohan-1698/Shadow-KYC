import { createWalletClient, createPublicClient, custom, http } from "viem";
import type { WalletClient } from "viem";
import { sepolia, dataHavenTestnet, NETWORKS } from "./networks";

// ── Module-level state ──────────────────────────────────────────────────
let connectedAddress: `0x${string}` | null = null;
let walletClientInstance: WalletClient | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let publicClientInstance: any = null;
let currentNetwork: "sepolia" | "dataHaven" = "sepolia";

// ── Helpers ─────────────────────────────────────────────────────────────

/** Returns the injected EIP-1193 provider (MetaMask, etc.) */
export function getEthereumProvider(): any {
  if (typeof window === "undefined" || !(window as any).ethereum) {
    throw new Error(
      "No Ethereum wallet found. Please install MetaMask or another Web3 wallet."
    );
  }
  return (window as any).ethereum;
}

/**
 * Asks the wallet to switch to a given chain.
 * Falls back to wallet_addEthereumChain when the chain is unknown.
 */
export async function switchToNetwork(
  network: "sepolia" | "dataHaven"
): Promise<void> {
  const provider = getEthereumProvider();
  const cfg = NETWORKS[network];
  const viemChain = network === "sepolia" ? sepolia : dataHavenTestnet;
  const targetChainHex = `0x${cfg.chainId.toString(16)}`;

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: targetChainHex }],
    });
  } catch (switchError: any) {
    // 4902 → chain not yet added to the wallet
    if (switchError.code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: targetChainHex,
            chainName: viemChain.name,
            nativeCurrency: viemChain.nativeCurrency,
            rpcUrls: [cfg.rpcUrl],
            blockExplorerUrls:
              network === "sepolia"
                ? [NETWORKS.sepolia.blockExplorer]
                : [],
          },
        ],
      });
    } else {
      throw switchError;
    }
  }

  currentNetwork = network;

  // Re-create clients for the new chain
  if (connectedAddress) {
    walletClientInstance = createWalletClient({
      chain: viemChain,
      account: connectedAddress,
      transport: custom(provider),
    });
    publicClientInstance = createPublicClient({
      chain: viemChain,
      transport: http(cfg.rpcUrl),
    });
  }
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Opens the wallet popup (e.g. MetaMask), asks the user to connect,
 * ensures the wallet is on **Sepolia** (default for ZK / normal ops),
 * and creates a viem WalletClient.
 */
export async function connectWallet(): Promise<`0x${string}`> {
  const provider = getEthereumProvider();

  const accounts: string[] = await provider.request({
    method: "eth_requestAccounts",
  });

  if (!accounts.length) {
    throw new Error("No accounts returned from wallet.");
  }

  connectedAddress = accounts[0] as `0x${string}`;

  // Default connection is Sepolia
  await switchToNetwork("sepolia");

  return connectedAddress;
}

/** Disconnects (clears local state). */
export function disconnectWallet(): void {
  connectedAddress = null;
  walletClientInstance = null;
  publicClientInstance = null;
  currentNetwork = "sepolia";
}

/** Returns the currently connected address (or null). */
export function getConnectedAddress(): `0x${string}` | null {
  return connectedAddress;
}

/** Returns which network the wallet is currently pointed at. */
export function getCurrentNetwork(): "sepolia" | "dataHaven" {
  return currentNetwork;
}

/** Returns the WalletClient; throws if not connected. */
export function getWalletClient(): WalletClient {
  if (!walletClientInstance) {
    throw new Error("Wallet not connected. Call connectWallet() first.");
  }
  return walletClientInstance;
}

/** Returns the PublicClient; throws if not connected. */
export function getPublicClient() {
  if (!publicClientInstance) {
    throw new Error("Public client not ready. Call connectWallet() first.");
  }
  return publicClientInstance;
}

/** Listen for account / chain changes and reset state accordingly. */
export function registerWalletListeners(
  onAccountChange?: (accounts: string[]) => void,
  onChainChange?: (chainId: string) => void
): void {
  try {
    const provider = getEthereumProvider();

    provider.on("accountsChanged", (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnectWallet();
      } else {
        connectedAddress = accounts[0] as `0x${string}`;
      }
      onAccountChange?.(accounts);
    });

    provider.on("chainChanged", (chainId: string) => {
      // Update currentNetwork tracker
      const numericId = parseInt(chainId, 16);
      if (numericId === NETWORKS.sepolia.chainId) currentNetwork = "sepolia";
      else if (numericId === NETWORKS.dataHaven.chainId) currentNetwork = "dataHaven";
      onChainChange?.(chainId);
    });
  } catch {
    // No provider – silently ignore
  }
}
