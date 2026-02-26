import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  CheckCircle, 
  AlertCircle, 
  ExternalLink, 
  Copy, 
  Download,
  Share2,
  Clock
} from 'lucide-react';
import { ShareVerificationDialog, type ShareableKycData } from '@/components/ShareVerificationDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

interface VerificationTabProps {
  userWalletAddress?: string;
  aadhaarUploadResult?: any;
  faceVerificationResult?: any;
  kycData?: any;
  proofData?: any;
  ipfsHash?: string;
  txHash?: string;
  proofJson?: any;
  publicJson?: any;
  onChainProofResult?: { txHash: string; blockNumber?: number } | null;
}

interface VerificationStatus {
  stage: 'pending' | 'processing' | 'verified' | 'failed';
  confidence: number;
  details: {
    aadhaarVerified: boolean;
    faceMatched: boolean;
    proofGenerated: boolean;
    blockchainConfirmed: boolean;
  };
  timestamp: Date;
}

export const VerificationTab: React.FC<VerificationTabProps> = ({
  userWalletAddress,
  aadhaarUploadResult,
  faceVerificationResult,
  kycData,
  proofData,
  ipfsHash,
  txHash,
  proofJson,
  publicJson,
  onChainProofResult,
}) => {
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>({
    stage: 'pending',
    confidence: 0,
    details: {
      aadhaarVerified: false,
      faceMatched: false,
      proofGenerated: false,
      blockchainConfirmed: false
    },
    timestamp: new Date()
  });

  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  // Update verification status based on completed steps
  useEffect(() => {
    const details = {
      aadhaarVerified: !!aadhaarUploadResult,
      faceMatched: !!faceVerificationResult?.verificationPassed,
      proofGenerated: !!proofData,
      blockchainConfirmed: !!txHash
    };

    const completedSteps = Object.values(details).filter(Boolean).length;
    const confidence = (completedSteps / 4) * 100;

    let stage: VerificationStatus['stage'] = 'pending';
    if (completedSteps === 4) stage = 'verified';
    else if (completedSteps > 0) stage = 'processing';

    setVerificationStatus({
      stage,
      confidence,
      details,
      timestamp: new Date()
    });
  }, [aadhaarUploadResult, faceVerificationResult, proofData, txHash]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const buildShareData = (): ShareableKycData => ({
    personalData: aadhaarUploadResult?.extractedData
      ? {
          name: aadhaarUploadResult.extractedData.name,
          dob: aadhaarUploadResult.extractedData.dob,
          gender: aadhaarUploadResult.extractedData.gender,
          state: aadhaarUploadResult.extractedData.address?.state ?? aadhaarUploadResult.extractedData.state,
        }
      : undefined,
    aadhaarImage: kycData?.images?.aadhaarImage ?? faceVerificationResult?.aadhaarImage,
    passportImage: kycData?.images?.passportImage ?? faceVerificationResult?.passportImage,
    liveImage: kycData?.images?.liveImage ?? faceVerificationResult?.liveImage,
  });

  const downloadVerificationReport = () => {
    const report = {
      walletAddress: userWalletAddress,
      verificationStatus,
      onChain: onChainProofResult ?? null,
      timestamp: new Date().toISOString(),
      proofHash: ipfsHash,
      transactionHash: txHash,
      // Include ZK proof files
      zkProof: {
        proof: proofJson,
        publicSignals: publicJson,
        algorithm: "Groth16",
        curve: "bn128"
      },
      // Verification data
      aadhaarData: aadhaarUploadResult ? {
        fileName: aadhaarUploadResult.fileName,
        uploadedAt: aadhaarUploadResult.uploadedAt,
        extractedData: aadhaarUploadResult.extractedData ? {
          name: aadhaarUploadResult.extractedData.name,
          dob: aadhaarUploadResult.extractedData.dob,
          gender: aadhaarUploadResult.extractedData.gender,
          state: aadhaarUploadResult.extractedData.address?.state
        } : null
      } : null,
      faceVerification: faceVerificationResult ? {
        verificationPassed: faceVerificationResult.verificationPassed,
        confidence: faceVerificationResult.confidence,
        details: faceVerificationResult.details
      } : null
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kyc-verification-report-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success('Comprehensive verification report downloaded with ZK proof files');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Verification Status
          </CardTitle>
          <CardDescription>
            View your KYC verification status and blockchain confirmation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <Badge variant={
              verificationStatus.stage === 'verified' ? 'default' : 
              verificationStatus.stage === 'processing' ? 'secondary' : 'outline'
            }>
              {verificationStatus.stage.charAt(0).toUpperCase() + verificationStatus.stage.slice(1)}
            </Badge>
            <span className="text-2xl font-bold">
              {verificationStatus.confidence.toFixed(0)}%
            </span>
          </div>
          <Progress value={verificationStatus.confidence} className="mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              {verificationStatus.details.aadhaarVerified ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <Clock className="h-4 w-4 text-gray-400" />
              )}
              <span className="text-sm">Aadhaar</span>
            </div>
            <div className="flex items-center gap-2">
              {verificationStatus.details.faceMatched ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <Clock className="h-4 w-4 text-gray-400" />
              )}
              <span className="text-sm">Face Match</span>
            </div>
            <div className="flex items-center gap-2">
              {verificationStatus.details.proofGenerated ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <Clock className="h-4 w-4 text-gray-400" />
              )}
              <span className="text-sm">ZK Proof</span>
            </div>
            <div className="flex items-center gap-2">
              {verificationStatus.details.blockchainConfirmed ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <Clock className="h-4 w-4 text-gray-400" />
              )}
              <span className="text-sm">Blockchain</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="offchain" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="offchain">Off-Chain Verification</TabsTrigger>
          <TabsTrigger value="onchain">On-Chain</TabsTrigger>
        </TabsList>

        {/* Off-Chain Verification */}
        <TabsContent value="offchain" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Off-Chain Verification Details</CardTitle>
              <CardDescription>
                Your verification data processed locally and securely
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Aadhaar Verification */}
              {aadhaarUploadResult && (
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Aadhaar Document
                    </h4>
                    <Badge variant="outline">Verified</Badge>
                    
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">File Name:</span>
                      <p className="font-mono mt-1 text-sm max-w-[180px] overflow-hidden text-ellipsis whitespace-nowrap">{aadhaarUploadResult.fileName}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Upload Time:</span>
                      <p>{aadhaarUploadResult.uploadedAt?.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Face Verification */}
              {faceVerificationResult && (
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium flex items-center gap-2">
                      {faceVerificationResult.verificationPassed ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                      Face Verification
                    </h4>
                    <Badge variant={faceVerificationResult.verificationPassed ? "default" : "destructive"}>
                      {faceVerificationResult.confidence.toFixed(1)}% Match
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      {faceVerificationResult.details.passportLiveMatch ? (
                        <CheckCircle className="h-3 w-3 text-green-500" />
                      ) : (
                        <AlertCircle className="h-3 w-3 text-red-500" />
                      )}
                      <span>Passport ↔ Live</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {faceVerificationResult.details.aadhaarLiveMatch ? (
                        <CheckCircle className="h-3 w-3 text-green-500" />
                      ) : (
                        <AlertCircle className="h-3 w-3 text-red-500" />
                      )}
                      <span>Aadhaar ↔ Live</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {faceVerificationResult.details.passportAadhaarMatch ? (
                        <CheckCircle className="h-3 w-3 text-green-500" />
                      ) : (
                        <AlertCircle className="h-3 w-3 text-red-500" />
                      )}
                      <span>Passport ↔ Aadhaar</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ZK Proof */}
              {proofData && (
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Zero-Knowledge Proof
                    </h4>
                    <Badge variant="outline">Generated</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(JSON.stringify(proofData), 'Proof data')}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy Proof
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        window.open(`https://ipfs.io/ipfs/${ipfsHash}`, '_blank');
                      }}
                      disabled={!ipfsHash}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      View on IPFS
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={downloadVerificationReport}
                  disabled={verificationStatus.stage === 'pending'}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Report
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShareDialogOpen(true)}
                  disabled={verificationStatus.stage === 'pending'}
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Share Verification
                </Button>
                {txHash && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      window.open(`https://etherscan.io/tx/${txHash}`, '_blank');
                    }}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Transaction
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* On-Chain (Sepolia) */}
        <TabsContent value="onchain" className="space-y-4">
          {onChainProofResult ? (
            <>
              {/* Transaction confirmation */}
              <Card className="border-green-500/40 bg-green-500/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle className="h-5 w-5" />
                    ZK Proof Stored on Sepolia
                  </CardTitle>
                  <CardDescription>
                    Your zero-knowledge proof is permanently recorded on the Ethereum Sepolia testnet.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Tx hash */}
                  <div className="rounded-lg border p-3 space-y-1">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Transaction Hash</p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs break-all flex-1">{onChainProofResult.txHash}</code>
                      <Button
                        variant="ghost" size="icon"
                        className="shrink-0 h-7 w-7"
                        onClick={() => copyToClipboard(onChainProofResult.txHash, 'Transaction hash')}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="shrink-0 h-7 w-7"
                        onClick={() => window.open(`https://sepolia.etherscan.io/tx/${onChainProofResult.txHash}`, '_blank')}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Block number */}
                  {onChainProofResult.blockNumber && (
                    <div className="rounded-lg border p-3 space-y-1">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Block Number</p>
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-semibold">{onChainProofResult.blockNumber.toLocaleString()}</code>
                        <Button
                          variant="ghost" size="icon"
                          className="shrink-0 h-7 w-7"
                          onClick={() => window.open(`https://sepolia.etherscan.io/block/${onChainProofResult.blockNumber}`, '_blank')}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Network + algorithm badges */}
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">Network: Sepolia</Badge>
                    <Badge variant="outline">Algorithm: Groth16</Badge>
                    <Badge variant="outline">Curve: BN128</Badge>
                    <Badge variant="outline">Chain ID: 11155111</Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Proof components */}
              {proofJson?.proof && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Proof Components</CardTitle>
                    <CardDescription>The Groth16 proof elements stored on-chain</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      { label: 'pi_A', value: proofJson.proof.pi_a },
                      { label: 'pi_B', value: proofJson.proof.pi_b },
                      { label: 'pi_C', value: proofJson.proof.pi_c },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-lg border p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
                          <Button
                            variant="ghost" size="icon"
                            className="h-6 w-6"
                            onClick={() => copyToClipboard(JSON.stringify(value), label)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <code className="text-xs break-all text-muted-foreground">{JSON.stringify(value)}</code>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Public signals */}
              {publicJson?.publicSignals && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Public Signals</CardTitle>
                    <CardDescription>Publicly verifiable outputs from the ZK circuit</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {(publicJson.publicSignals as string[]).map((sig: string, i: number) => (
                        <div key={i} className="rounded-lg border p-3 space-y-1">
                          <p className="text-xs text-muted-foreground">Signal [{i}]</p>
                          <div className="flex items-center gap-1">
                            <code className="text-xs break-all flex-1">{sig.length > 20 ? sig.slice(0, 10) + '…' + sig.slice(-8) : sig}</code>
                            <Button
                              variant="ghost" size="icon"
                              className="h-6 w-6 shrink-0"
                              onClick={() => copyToClipboard(sig, `Signal [${i}]`)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {publicJson.credentialHash && (
                      <div className="mt-3 rounded-lg border p-3 space-y-1">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Credential Hash (bytes32)</p>
                        <div className="flex items-center gap-2">
                          <code className="text-xs break-all flex-1">{publicJson.credentialHash}</code>
                          <Button
                            variant="ghost" size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={() => copyToClipboard(publicJson.credentialHash, 'Credential hash')}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Quick actions */}
              <Card>
                <CardHeader><CardTitle className="text-base">Actions</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => window.open(`https://sepolia.etherscan.io/tx/${onChainProofResult.txHash}`, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View on Etherscan
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => copyToClipboard(onChainProofResult.txHash, 'Transaction hash')}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Tx Hash
                    </Button>
                    <Button
                      variant="outline"
                      onClick={downloadVerificationReport}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Full Report
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>On-Chain Proof Not Yet Stored</CardTitle>
                <CardDescription>
                  Complete ZK proof generation to automatically store your proof on Sepolia.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    After generating your ZK proof, it will be stored on the Ethereum Sepolia testnet. The transaction hash and block number will appear here once confirmed.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <ShareVerificationDialog
        open={shareDialogOpen}
        onClose={() => setShareDialogOpen(false)}
        data={buildShareData()}
      />
    </div>
  );
};