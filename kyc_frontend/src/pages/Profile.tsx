import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Edit, Shield, Loader2, RefreshCw, AlertCircle, CheckCircle2, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { getKycDataFromDataHaven } from '@/services/storageService';
import { isWalletConnected, getConnectedAddress, connectWallet } from '@/services/clientService';
import { ShareVerificationDialog, type ShareableKycData } from '@/components/ShareVerificationDialog';
import type { KYCDataToStore } from '@/types';

type LoadState = 'idle' | 'loading' | 'loaded' | 'error' | 'no-wallet' | 'empty';

const Profile = () => {
  const navigate = useNavigate();
  const [kycData, setKycData] = useState<KYCDataToStore | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [address, setAddress] = useState<string | null>(getConnectedAddress());
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  const fetchKycData = async () => {
    const addr = getConnectedAddress();
    if (!addr) {
      setLoadState('no-wallet');
      return;
    }
    setAddress(addr);
    setLoadState('loading');
    setErrorMsg('');
    try {
      const data = await getKycDataFromDataHaven();
      if (!data) {
        setLoadState('empty');
      } else {
        setKycData(data);
        setLoadState('loaded');
      }
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Failed to fetch KYC data');
      setLoadState('error');
    }
  };

  useEffect(() => {
    fetchKycData();
  }, []);

  const handleConnectAndFetch = async () => {
    try {
      await connectWallet();
      setAddress(getConnectedAddress());
      fetchKycData();
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Wallet connection failed');
      setLoadState('error');
    }
  };

  const extracted = kycData?.aadhaarData?.extractedData;

  const shareData: ShareableKycData = {
    personalData: extracted
      ? { name: extracted.name, dob: extracted.dob, gender: extracted.gender, state: extracted.state }
      : undefined,
    aadhaarImage: kycData?.images?.aadhaarImage,
    passportImage: kycData?.images?.passportImage,
    liveImage: kycData?.images?.liveImage,
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2">Profile</h1>
              <p className="text-muted-foreground">Your KYC verification details from DataHaven</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={fetchKycData} disabled={loadState === 'loading'}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loadState === 'loading' ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              {loadState === 'loaded' && (
                <Button variant="outline" onClick={() => setShareDialogOpen(true)}>
                  <Share2 className="mr-2 h-4 w-4" />
                  Share
                </Button>
              )}
              <Button
                onClick={() => navigate('/kyc')}
                className="bg-gradient-primary hover:shadow-glow transition-all duration-300"
              >
                <Edit className="mr-2 h-4 w-4" />
                Update KYC
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* KYC Details Card */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  KYC Information
                </CardTitle>
                <CardDescription>
                  {address ? `Wallet: ${address.slice(0, 8)}…${address.slice(-6)}` : 'No wallet connected'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Loading */}
                {loadState === 'loading' && (
                  <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm">Fetching KYC data from DataHaven…</p>
                  </div>
                )}

                {/* No wallet */}
                {loadState === 'no-wallet' && (
                  <div className="flex flex-col items-center gap-4 py-12">
                    <AlertCircle className="h-10 w-10 text-yellow-500" />
                    <p className="text-sm text-muted-foreground">Connect your wallet to view your KYC profile.</p>
                    <Button onClick={handleConnectAndFetch}>🔗 Connect Wallet</Button>
                  </div>
                )}

                {/* Error */}
                {loadState === 'error' && (
                  <div className="flex flex-col gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                      <AlertCircle className="h-5 w-5" />
                      <span className="font-medium">Failed to load KYC data</span>
                    </div>
                    <p className="text-sm text-red-600 dark:text-red-400">{errorMsg}</p>
                    <Button size="sm" variant="outline" onClick={fetchKycData}>Try Again</Button>
                  </div>
                )}

                {/* Empty */}
                {loadState === 'empty' && (
                  <div className="flex flex-col items-center gap-4 py-12 text-muted-foreground">
                    <Shield className="h-10 w-10" />
                    <p className="text-sm">No KYC data found. Complete the KYC process first.</p>
                    <Button onClick={() => navigate('/kyc')}>Start KYC Process</Button>
                  </div>
                )}

                {/* Loaded */}
                {loadState === 'loaded' && extracted && (
                  <div className="space-y-5">
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="text-sm font-medium">KYC data retrieved from DataHaven Testnet</span>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-5 gap-x-8">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Full Name</p>
                        <p className="font-semibold text-lg">{extracted.name || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Date of Birth</p>
                        <p className="font-semibold text-lg">{extracted.dob || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Gender</p>
                        <p className="font-semibold text-lg">
                          {extracted.gender === 'M' ? 'Male' : extracted.gender === 'F' ? 'Female' : extracted.gender || '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">State</p>
                        <p className="font-semibold text-lg">{extracted.state || '—'}</p>
                      </div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-8 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Aadhaar File</p>
                        <p className="font-mono text-xs truncate">{kycData?.aadhaarData?.fileName || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Upload Date</p>
                        <p className="text-xs">
                          {kycData?.aadhaarData?.uploadedAt
                            ? new Date(kycData.aadhaarData.uploadedAt).toLocaleString()
                            : '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Status Card */}
            <Card>
              <CardHeader>
                <CardTitle>Verification Status</CardTitle>
                <CardDescription>Your KYC verification level</CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                {loadState === 'loaded' && extracted ? (
                  <>
                    <div className="h-32 w-32 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="h-16 w-16 text-green-500" />
                    </div>
                    <Badge className="bg-green-500 text-white mb-2">Verified</Badge>
                    <p className="text-xs text-muted-foreground mt-2 mb-4">KYC completed via Aadhaar</p>
                    <Button onClick={() => navigate('/kyc')} size="sm" variant="outline" className="w-full">
                      Update KYC
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="h-32 w-32 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                      <Shield className="h-16 w-16 text-muted-foreground" />
                    </div>
                    <p className="font-medium mb-2 text-muted-foreground">Not Verified</p>
                    <p className="text-xs text-muted-foreground mb-4">Begin KYC to get verified</p>
                    <Button onClick={() => navigate('/kyc')} size="sm" className="w-full">
                      Start KYC Process
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Images Card */}
            {loadState === 'loaded' && kycData?.images && (
              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    Verification Images
                  </CardTitle>
                  <CardDescription>Stored securely in your private DataHaven bucket</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    {kycData.images.aadhaarImage && (
                      <div className="flex flex-col items-center gap-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Aadhaar Photo</p>
                        <img
                          src={kycData.images.aadhaarImage}
                          alt="Aadhaar"
                          className="w-full max-w-[180px] rounded-lg border object-cover aspect-square"
                        />
                      </div>
                    )}
                    {kycData.images.passportImage && (
                      <div className="flex flex-col items-center gap-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Passport Photo</p>
                        <img
                          src={kycData.images.passportImage}
                          alt="Passport"
                          className="w-full max-w-[180px] rounded-lg border object-cover aspect-square"
                        />
                      </div>
                    )}
                    {kycData.images.liveImage && (
                      <div className="flex flex-col items-center gap-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Live Capture</p>
                        <img
                          src={kycData.images.liveImage}
                          alt="Live"
                          className="w-full max-w-[180px] rounded-lg border object-cover aspect-square"
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </motion.div>
      </div>

      <ShareVerificationDialog
        open={shareDialogOpen}
        onClose={() => setShareDialogOpen(false)}
        data={shareData}
      />
    </div>
  );
};

export default Profile;
