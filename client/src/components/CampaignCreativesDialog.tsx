import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Image, Video, Sparkles, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface CampaignCreativesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: number;
  serviceId?: number | null;
  onSuccess?: () => void;
}

export function CampaignCreativesDialog({
  open,
  onOpenChange,
  campaignId,
  serviceId,
  onSuccess,
}: CampaignCreativesDialogProps) {
  const [includeImages, setIncludeImages] = useState(true);
  const [includeVideos, setIncludeVideos] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: videoCredits } = trpc.videoCredits.getBalance.useQuery();

  const generateMutation = trpc.campaigns.generateCreatives.useMutation({
    onSuccess: (data) => {
      toast.success(`Generated ${data.imagesCount} images and ${data.videosCount} videos!`);
      onSuccess?.();
      onOpenChange(false);
      setIsGenerating(false);
    },
    onError: (error) => {
      toast.error(`Failed to generate creatives: ${error.message}`);
      setIsGenerating(false);
    },
  });

  const handleGenerate = () => {
    console.log('Generate button clicked', { includeImages, includeVideos, serviceId, campaignId });
    if (!includeImages && !includeVideos) {
      toast.error("Please select at least one format (Images or Videos)");
      return;
    }

    if (!serviceId) {
      toast.error("Please link a service to this campaign first");
      return;
    }

    const estimatedVideoCredits = includeVideos ? 5 : 0; // 5 videos × 1 credit each
    if (includeVideos && (videoCredits?.balance || 0) < estimatedVideoCredits) {
      toast.error(`Insufficient video credits. Need ${estimatedVideoCredits}, have ${videoCredits?.balance || 0}`);
      return;
    }

    setIsGenerating(true);
    generateMutation.mutate({
      campaignId,
      serviceId,
      includeImages,
      includeVideos,
    });
  };

  const estimatedImages = includeImages ? 5 : 0;
  const estimatedVideos = includeVideos ? 5 : 0;
  const estimatedCredits = estimatedVideos; // Images are free, videos cost credits

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Generate Your Ad Images</DialogTitle>
          <DialogDescription>
            Create images and videos for your Meta ad campaigns. Select the formats you need.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Format Selection */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Ad Formats</Label>
            
            {/* Images Option */}
            <Card className={`cursor-pointer transition-all ${includeImages ? "border-primary bg-primary/5" : "border-border"}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <Checkbox
                    id="include-images"
                    checked={includeImages}
                    onCheckedChange={(checked) => setIncludeImages(checked as boolean)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Image className="w-5 h-5 text-primary" />
                      <Label htmlFor="include-images" className="text-base font-semibold cursor-pointer">
                        Images (5 variations)
                      </Label>
                      <span className="ml-auto text-sm font-medium text-green-500">FREE</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Static ad creatives with different styles: Tabloid, Before/After, Stats, Testimonial
                    </p>
                    <div className="mt-2 text-xs text-muted-foreground">
                      • 1080×1080 square format (Meta standard)
                      • 5 variations with different angles
                      • Instant generation
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Videos Option */}
            <Card className={`cursor-pointer transition-all ${includeVideos ? "border-primary bg-primary/5" : "border-border"}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <Checkbox
                    id="include-videos"
                    checked={includeVideos}
                    onCheckedChange={(checked) => setIncludeVideos(checked as boolean)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Video className="w-5 h-5 text-primary" />
                      <Label htmlFor="include-videos" className="text-base font-semibold cursor-pointer">
                        Videos (5 variations)
                      </Label>
                      <span className="ml-auto text-sm font-medium text-primary">{estimatedVideos} credits</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Video ads with voiceover: Explainer, Testimonial, Proof & Results, Mechanism Reveal
                    </p>
                    <div className="mt-2 text-xs text-muted-foreground">
                      • 30s and 60s durations
                      • Professional voiceover (ElevenLabs)
                      • Stock footage or kinetic typography
                      • Takes 2-3 minutes to render
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recommendation Banner */}
          <Card className="bg-blue-500/10 border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-blue-500 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-blue-500">Meta Best Practice</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Campaigns with both image and video ads get 40% better performance. We recommend selecting both formats.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Credit Warning */}
          {includeVideos && (videoCredits?.balance || 0) < estimatedCredits && (
            <Card className="bg-red-500/10 border-red-500/20">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-500">Insufficient Credits</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      You need {estimatedCredits} video credits but only have {videoCredits?.balance || 0}. 
                      Please purchase more credits or uncheck videos.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total Assets:</span>
              <span className="font-semibold">{estimatedImages + estimatedVideos} creatives</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-muted-foreground">Total Credits:</span>
              <span className="font-semibold">{estimatedCredits} credits</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-muted-foreground">Available Credits:</span>
              <span className="font-semibold">{videoCredits?.balance || 0} credits</span>
            </div>
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || (!includeImages && !includeVideos) || !serviceId}
            className="w-full"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating Creatives...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Your Ad Images
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
