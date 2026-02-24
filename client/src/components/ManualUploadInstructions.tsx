import { Card } from "./ui/card";
import { Alert, AlertDescription } from "./ui/alert";
import { Info, ExternalLink } from "lucide-react";
import { Button } from "./ui/button";

export function ManualUploadInstructions() {
  return (
    <Card className="p-6 bg-blue-500/5 border-blue-500/20">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
          <Info className="w-5 h-5 text-blue-500" />
        </div>
        
        <div className="flex-1 space-y-4">
          <div>
            <h3 className="text-lg font-bold mb-2">
              Manual Upload to Meta Ads Manager
            </h3>
            <p className="text-sm text-muted-foreground">
              While our direct Meta integration is pending approval (6-8 weeks), you can manually upload your video to Ads Manager.
            </p>
          </div>

          <Alert className="bg-background/50">
            <AlertDescription className="text-sm space-y-3">
              <div>
                <strong className="font-semibold">Step 1: Download Your Video</strong>
                <p className="text-muted-foreground mt-1">
                  Click the "Download MP4" button above to save your video locally.
                </p>
              </div>

              <div>
                <strong className="font-semibold">Step 2: Open Meta Ads Manager</strong>
                <p className="text-muted-foreground mt-1">
                  Go to{" "}
                  <a
                    href="https://business.facebook.com/adsmanager"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline inline-flex items-center gap-1"
                  >
                    Meta Ads Manager
                    <ExternalLink className="w-3 h-3" />
                  </a>{" "}
                  and log in to your account.
                </p>
              </div>

              <div>
                <strong className="font-semibold">Step 3: Create a New Ad</strong>
                <p className="text-muted-foreground mt-1">
                  Click "Create" → Choose your campaign objective → Select "Video" as your ad format.
                </p>
              </div>

              <div>
                <strong className="font-semibold">Step 4: Upload Your Video</strong>
                <p className="text-muted-foreground mt-1">
                  In the "Media" section, click "Add Media" → "Upload" → Select the downloaded MP4 file.
                </p>
              </div>

              <div>
                <strong className="font-semibold">Step 5: Complete Your Ad Setup</strong>
                <p className="text-muted-foreground mt-1">
                  Add your headline, description, call-to-action button, and destination URL. Review and publish your ad.
                </p>
              </div>
            </AlertDescription>
          </Alert>

          <div className="flex items-center gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              asChild
            >
              <a
                href="https://www.facebook.com/business/help/1695989927329474"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Meta Video Ad Guide
              </a>
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              asChild
            >
              <a
                href="https://business.facebook.com/adsmanager"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open Ads Manager
              </a>
            </Button>
          </div>

          <p className="text-xs text-muted-foreground pt-2 border-t">
            💡 <strong>Coming Soon:</strong> Once Meta approves our integration, you'll be able to push videos directly to Ads Manager with one click—no manual upload needed.
          </p>
        </div>
      </div>
    </Card>
  );
}
