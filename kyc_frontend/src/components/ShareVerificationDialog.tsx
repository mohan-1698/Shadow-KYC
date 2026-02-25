import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Share2, Download, User, Image } from 'lucide-react';
import { toast } from 'sonner';

export interface ShareableKycData {
  personalData?: {
    name?: string;
    dob?: string;
    gender?: string;
    state?: string;
  };
  aadhaarImage?: string;   // base64
  passportImage?: string;  // base64
  liveImage?: string;      // base64
}

interface ShareVerificationDialogProps {
  open: boolean;
  onClose: () => void;
  data: ShareableKycData;
}

interface SelectionState {
  personalData: boolean;
  aadhaarImage: boolean;
  passportImage: boolean;
  liveImage: boolean;
}

export const ShareVerificationDialog: React.FC<ShareVerificationDialogProps> = ({
  open,
  onClose,
  data,
}) => {
  const [selection, setSelection] = useState<SelectionState>({
    personalData: true,
    aadhaarImage: false,
    passportImage: false,
    liveImage: false,
  });

  const toggle = (key: keyof SelectionState) =>
    setSelection((prev) => ({ ...prev, [key]: !prev[key] }));

  const noneSelected = !Object.values(selection).some(Boolean);

  const handleShare = () => {
    const payload: Record<string, unknown> = {
      generatedAt: new Date().toISOString(),
      source: 'Shadow-KYC / DataHaven',
    };

    if (selection.personalData && data.personalData) {
      payload.personalData = data.personalData;
    }
    if (selection.aadhaarImage && data.aadhaarImage) {
      payload.aadhaarImage = data.aadhaarImage;
    }
    if (selection.passportImage && data.passportImage) {
      payload.passportImage = data.passportImage;
    }
    if (selection.liveImage && data.liveImage) {
      payload.liveImage = data.liveImage;
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kyc-share-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('Verification data exported successfully');
    onClose();
  };

  // Availability flags
  const has = {
    personalData: !!data.personalData && Object.values(data.personalData).some(Boolean),
    aadhaarImage: !!data.aadhaarImage,
    passportImage: !!data.passportImage,
    liveImage: !!data.liveImage,
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            Share Verification
          </DialogTitle>
          <DialogDescription>
            Choose which data to include in the exported file. Only selected items will be shared.
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <div className="space-y-4 py-2">
          {/* Personal Data */}
          <div
            className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
              has.personalData
                ? 'cursor-pointer hover:bg-muted/50'
                : 'opacity-40 cursor-not-allowed'
            } ${selection.personalData && has.personalData ? 'border-primary bg-primary/5' : ''}`}
            onClick={() => has.personalData && toggle('personalData')}
          >
            <Checkbox
              id="personalData"
              checked={selection.personalData}
              disabled={!has.personalData}
              onCheckedChange={() => has.personalData && toggle('personalData')}
              className="mt-0.5"
            />
            <div className="flex-1 min-w-0">
              <Label htmlFor="personalData" className="flex items-center gap-2 cursor-pointer font-medium">
                <User className="h-4 w-4 text-primary" />
                Personal Data
              </Label>
              {data.personalData && (
                <p className="text-xs text-muted-foreground mt-1">
                  {[data.personalData.name, data.personalData.dob, data.personalData.gender, data.personalData.state]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
              {!has.personalData && <p className="text-xs text-muted-foreground mt-1">Not available</p>}
            </div>
          </div>

          {/* Aadhaar Image */}
          <div
            className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
              has.aadhaarImage
                ? 'cursor-pointer hover:bg-muted/50'
                : 'opacity-40 cursor-not-allowed'
            } ${selection.aadhaarImage && has.aadhaarImage ? 'border-primary bg-primary/5' : ''}`}
            onClick={() => has.aadhaarImage && toggle('aadhaarImage')}
          >
            <Checkbox
              id="aadhaarImage"
              checked={selection.aadhaarImage}
              disabled={!has.aadhaarImage}
              onCheckedChange={() => has.aadhaarImage && toggle('aadhaarImage')}
              className="mt-0.5"
            />
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex-1">
                <Label htmlFor="aadhaarImage" className="flex items-center gap-2 cursor-pointer font-medium">
                  <Image className="h-4 w-4 text-primary" />
                  Aadhaar Photo
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  {has.aadhaarImage ? 'Photo extracted from Aadhaar document' : 'Not available'}
                </p>
              </div>
              {has.aadhaarImage && (
                <img
                  src={data.aadhaarImage}
                  alt="Aadhaar"
                  className="h-10 w-10 rounded object-cover border flex-shrink-0"
                />
              )}
            </div>
          </div>

          {/* Passport Image */}
          <div
            className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
              has.passportImage
                ? 'cursor-pointer hover:bg-muted/50'
                : 'opacity-40 cursor-not-allowed'
            } ${selection.passportImage && has.passportImage ? 'border-primary bg-primary/5' : ''}`}
            onClick={() => has.passportImage && toggle('passportImage')}
          >
            <Checkbox
              id="passportImage"
              checked={selection.passportImage}
              disabled={!has.passportImage}
              onCheckedChange={() => has.passportImage && toggle('passportImage')}
              className="mt-0.5"
            />
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex-1">
                <Label htmlFor="passportImage" className="flex items-center gap-2 cursor-pointer font-medium">
                  <Image className="h-4 w-4 text-primary" />
                  Passport Size Photo
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  {has.passportImage ? 'Passport-size photo provided during KYC' : 'Not available'}
                </p>
              </div>
              {has.passportImage && (
                <img
                  src={data.passportImage}
                  alt="Passport"
                  className="h-10 w-10 rounded object-cover border flex-shrink-0"
                />
              )}
            </div>
          </div>

          {/* Live Image */}
          <div
            className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
              has.liveImage
                ? 'cursor-pointer hover:bg-muted/50'
                : 'opacity-40 cursor-not-allowed'
            } ${selection.liveImage && has.liveImage ? 'border-primary bg-primary/5' : ''}`}
            onClick={() => has.liveImage && toggle('liveImage')}
          >
            <Checkbox
              id="liveImage"
              checked={selection.liveImage}
              disabled={!has.liveImage}
              onCheckedChange={() => has.liveImage && toggle('liveImage')}
              className="mt-0.5"
            />
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex-1">
                <Label htmlFor="liveImage" className="flex items-center gap-2 cursor-pointer font-medium">
                  <Image className="h-4 w-4 text-primary" />
                  Live Capture
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  {has.liveImage ? 'Live face capture taken during verification' : 'Not available'}
                </p>
              </div>
              {has.liveImage && (
                <img
                  src={data.liveImage}
                  alt="Live"
                  className="h-10 w-10 rounded object-cover border flex-shrink-0"
                />
              )}
            </div>
          </div>
        </div>

        <Separator />

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleShare} disabled={noneSelected}>
            Share
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
