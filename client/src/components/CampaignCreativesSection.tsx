import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, ExternalLink, Loader2, PackageOpen, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import JSZip from "jszip";

interface CampaignCreativesSectionProps {
  campaignId: number;
}

export function CampaignCreativesSection({ campaignId }: CampaignCreativesSectionProps) {
  const { toast } = useToast();
  const [isDownloading, setIsDownloading] = useState(false);
  const [regeneratingImageIds, setRegeneratingImageIds] = useState<Set<number>>(new Set());
  const [regeneratingVideoIds, setRegeneratingVideoIds] = useState<Set<number>>(new Set());

  const utils = trpc.useUtils();

  // Fetch ad images
  const { data: batches, isLoading: imagesLoading } = trpc.adCreatives.list.useQuery();
  // Flatten batches to individual creatives and filter by campaignId
  const campaignImages = batches?.flatMap(batch => batch.creatives).filter(img => img.campaignId === campaignId) || [];

  // Fetch videos
  const { data: videos, isLoading: videosLoading } = trpc.videos.list.useQuery({});
  const campaignVideos = videos?.filter((vid) => vid.campaignId === campaignId) || [];

  // Bulk download mutation
  const downloadAll = trpc.campaigns.downloadAllCreatives.useMutation();

  // Regenerate single image mutation
  const regenerateImage = trpc.adCreatives.regenerateSingle.useMutation({
    onSuccess: (data) => {
      utils.adCreatives.list.invalidate();
      toast({
        title: "Image Regenerated",
        description: "A new image has been generated successfully.",
      });
      setRegeneratingImageIds(prev => {
        const next = new Set(prev);
        next.delete(data.id);
        return next;
      });
    },
    onError: (error, variables) => {
      toast({
        title: "Regeneration Failed",
        description: error.message || "Failed to regenerate image. Please try again.",
        variant: "destructive",
      });
      setRegeneratingImageIds(prev => {
        const next = new Set(prev);
        next.delete(variables.id);
        return next;
      });
    },
  });

  // Regenerate single video mutation
  const regenerateVideo = trpc.videos.regenerateSingle.useMutation({
    onSuccess: (data) => {
      utils.videos.list.invalidate();
      toast({
        title: "Video Re-queued",
        description: "Video is being re-rendered. This may take a few minutes.",
      });
      setRegeneratingVideoIds(prev => {
        const next = new Set(prev);
        next.delete(data.videoId);
        return next;
      });
    },
    onError: (error, variables) => {
      toast({
        title: "Regeneration Failed",
        description: error.message || "Failed to re-queue video. Please try again.",
        variant: "destructive",
      });
      setRegeneratingVideoIds(prev => {
        const next = new Set(prev);
        next.delete(variables.videoId);
        return next;
      });
    },
  });

  const handleRegenerateImage = (id: number) => {
    setRegeneratingImageIds(prev => new Set(prev).add(id));
    regenerateImage.mutate({ id });
  };

  const handleRegenerateVideo = (videoId: number) => {
    setRegeneratingVideoIds(prev => new Set(prev).add(videoId));
    regenerateVideo.mutate({ videoId });
  };

  const handleBulkDownload = async () => {
    try {
      setIsDownloading(true);
      
      // Use server-side ZIP endpoint to avoid CORS issues with CDN images/videos
      const a = document.createElement("a");
      a.href = `/api/campaigns/${campaignId}/download-zip`;
      a.download = "campaign-creatives.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      toast({
        title: "Download Started",
        description: "Your ZIP file is being prepared and will download shortly.",
      });
    } catch (error) {
      console.error("Bulk download failed:", error);
      toast({
        title: "Download Failed",
        description: "Failed to download creatives. Please try again.",
        variant: "destructive",
      });
    } finally {
      // Give a moment before resetting the loading state
      setTimeout(() => setIsDownloading(false), 2000);
    }
  };

  const isLoading = imagesLoading || videosLoading;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Campaign Creatives</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const totalCreatives = campaignImages.length + campaignVideos.length;

  if (totalCreatives === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Campaign Creatives</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground mb-4">
            No creatives generated yet. Use the "Your Ad Images" generator above to create images and videos.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle>Campaign Creatives ({totalCreatives})</CardTitle>
        {totalCreatives > 0 && (
          <Button
            onClick={handleBulkDownload}
            disabled={isDownloading}
            variant="outline"
            size="sm"
          >
            {isDownloading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <PackageOpen className="w-4 h-4 mr-2" />
                Download All as ZIP
              </>
            )}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Ad Images Section */}
        {campaignImages.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4">
              Ad Images ({campaignImages.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {campaignImages.map((image) => {
                const isRegenerating = regeneratingImageIds.has(image.id);
                return (
                  <Card key={image.id} className="overflow-hidden">
                    <div className="aspect-square relative bg-muted">
                      {isRegenerating ? (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                          <Loader2 className="w-8 h-8 animate-spin text-primary" />
                          <span className="text-xs text-muted-foreground">Regenerating...</span>
                        </div>
                      ) : (
                        <img
                          src={image.imageUrl}
                          alt={image.headline}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <CardContent className="p-4 space-y-2">
                      <p className="font-medium text-sm line-clamp-2">
                        {image.headline}
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-xs">
                          {image.designStyle}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          1080×1080
                        </Badge>
                      </div>
                      {image.complianceChecked && (
                        <Badge variant="default" className="text-xs bg-green-600">
                          ✓ Meta Compliant
                        </Badge>
                      )}
                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => handleRegenerateImage(image.id)}
                          disabled={isRegenerating}
                        >
                          {isRegenerating ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <RefreshCw className="w-4 h-4 mr-1" />
                              Regen
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          asChild
                          disabled={isRegenerating}
                        >
                          <a href={image.imageUrl} download target="_blank">
                            <Download className="w-4 h-4 mr-1" />
                            Download
                          </a>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Videos Section */}
        {campaignVideos.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4">
              Videos ({campaignVideos.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {campaignVideos.map((video) => {
                const isRegenerating = regeneratingVideoIds.has(video.id);
                const isFailed = video.creatomateStatus === "failed";
                const isProcessing = video.creatomateStatus === "queued" || video.creatomateStatus === "rendering" || isRegenerating;
                return (
                  <Card key={video.id} className="overflow-hidden">
                    <div className="aspect-video relative bg-muted">
                      {video.creatomateStatus === "succeeded" && video.videoUrl ? (
                        <video
                          src={video.videoUrl}
                          className="w-full h-full object-cover"
                          controls
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                          {isProcessing ? (
                            <>
                              <Loader2 className="w-8 h-8 animate-spin text-primary" />
                              <span className="text-xs text-muted-foreground">
                                {isRegenerating ? "Re-queuing..." : video.creatomateStatus === "rendering" ? "Rendering..." : "Queued..."}
                              </span>
                            </>
                          ) : (
                            <span className="text-muted-foreground text-sm">
                              {video.creatomateStatus}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-xs">
                          {video.videoType}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {video.duration}s
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {video.visualStyle}
                        </Badge>
                      </div>
                      <Badge
                        variant={
                          video.creatomateStatus === "succeeded"
                            ? "default"
                            : isFailed
                            ? "destructive"
                            : "secondary"
                        }
                        className="text-xs"
                      >
                        {video.creatomateStatus}
                      </Badge>
                      {video.creatomateStatus === "succeeded" && (
                        <Badge variant="default" className="text-xs bg-green-600">
                          ✓ Meta Ads Compliant
                        </Badge>
                      )}
                      <div className="flex gap-2 pt-2">
                        {/* Regenerate button — shown for failed or succeeded videos */}
                        {(isFailed || video.creatomateStatus === "succeeded") && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => handleRegenerateVideo(video.id)}
                            disabled={isRegenerating}
                          >
                            {isRegenerating ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <RefreshCw className="w-4 h-4 mr-1" />
                                {isFailed ? "Retry" : "Regen"}
                              </>
                            )}
                          </Button>
                        )}
                        {video.creatomateStatus === "succeeded" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              asChild
                            >
                              <a href={`/videos/${video.id}`}>
                                <ExternalLink className="w-4 h-4 mr-1" />
                                View
                              </a>
                            </Button>
                            {video.videoUrl && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1"
                                asChild
                              >
                                <a href={video.videoUrl} download target="_blank">
                                  <Download className="w-4 h-4 mr-1" />
                                  Download
                                </a>
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
