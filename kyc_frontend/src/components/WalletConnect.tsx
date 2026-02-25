import { useState, useEffect, useCallback } from "react";
import { Wallet, CheckCircle2, XCircle, LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  connectWallet as clientConnect,
  disconnectWallet as clientDisconnect,
  getConnectedAddress,
  registerWalletListeners,
} from "@/services/clientService";
import {
  isAuthenticated,
  clearSession,
  getAuthenticatedUser,
} from "@/services/mspService";
import { NETWORKS } from "@/services/networks";

interface WalletConnectProps {
  onWalletChange?: (address: string | null) => void;
}

export const WalletConnect = ({ onWalletChange }: WalletConnectProps) => {
  const [walletAddress, setWalletAddress] = useState<string | null>(
    getConnectedAddress()
  );
  const [kycVerified, setKycVerified] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [networkName, setNetworkName] = useState<string>(
    NETWORKS.sepolia.name
  );

  // Restore persisted session on mount
  useEffect(() => {
    if (isAuthenticated()) {
      const user = getAuthenticatedUser();
      if (user?.address) {
        setWalletAddress(user.address as `0x${string}`);
        onWalletChange?.(user.address);
      }
    }
  }, []);

  // Register wallet change listeners once
  useEffect(() => {
    registerWalletListeners(
      (accounts) => {
        if (accounts.length === 0) {
          handleDisconnect();
        } else {
          setWalletAddress(accounts[0] as `0x${string}`);
          onWalletChange?.(accounts[0]);
        }
      },
      (chainId) => {
        const numericId = parseInt(chainId, 16);
        if (numericId === NETWORKS.sepolia.chainId) {
          setNetworkName(NETWORKS.sepolia.name);
        } else if (numericId === NETWORKS.dataHaven.chainId) {
          setNetworkName(NETWORKS.dataHaven.name);
        }
      }
    );
  }, []);

  /** Connect wallet on Sepolia (default for ZK proofs) */
  const handleConnect = useCallback(async () => {
    setConnecting(true);
    try {
      const address = await clientConnect();
      setWalletAddress(address);
      onWalletChange?.(address);
      setNetworkName(NETWORKS.sepolia.name);

      toast({
        title: "Wallet Connected",
        description: `Connected on ${NETWORKS.sepolia.name}`,
      });
    } catch (err: any) {
      const msg = err?.message ?? "Failed to connect wallet";
      toast({
        title: "Connection Failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setConnecting(false);
    }
  }, [onWalletChange]);

  /** Disconnect everything */
  const handleDisconnect = useCallback(() => {
    clientDisconnect();
    clearSession();
    setWalletAddress(null);
    setKycVerified(false);
    onWalletChange?.(null);
    toast({
      title: "Wallet Disconnected",
      description: "Your wallet has been disconnected",
    });
  }, [onWalletChange]);

  // ── Not connected ─────────────────────────────────────────────────────
  if (!walletAddress) {
    return (
      <Button
        onClick={handleConnect}
        disabled={connecting}
        className="bg-gradient-primary hover:shadow-glow transition-all duration-300"
      >
        {connecting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Wallet className="mr-2 h-4 w-4" />
        )}
        {connecting ? "Connecting..." : "Connect Wallet"}
      </Button>
    );
  }

  // ── Connected ─────────────────────────────────────────────────────────
  return (
    <Card className="p-4 bg-gradient-card border-border/50">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </p>
            <p className="text-xs text-muted-foreground">{networkName}</p>
            <div className="flex items-center gap-2 mt-1">
              {kycVerified ? (
                <>
                  <CheckCircle2 className="h-3 w-3 text-success" />
                  <Badge
                    variant="outline"
                    className="text-xs bg-success/10 text-success border-success/20"
                  >
                    KYC Verified
                  </Badge>
                </>
              ) : (
                <>
                  <XCircle className="h-3 w-3 text-warning" />
                  <Badge
                    variant="outline"
                    className="text-xs bg-warning/10 text-warning border-warning/20"
                  >
                    Not Verified
                  </Badge>
                </>
              )}
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDisconnect}
          className="hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
};
