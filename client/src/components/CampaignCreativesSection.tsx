import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, ExternalLink, Loader2, PackageOpen } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import JSZip from "jszip";

interface CampaignCreativesSectionProps {
  campaignId: number;
}

export function CampaignCreativesSection({ campaignId }: CampaignCreativesSectionProps) {
  const { toast } = useToast();
  const [isDownloading, setIsDownloading] = useState(false);

  // Fetch ad images
  const { data: images, isLoading: imagesLoading } = trpc.adCreatives.list.useQuery();
  const campaignImages = images?.filter((img) => img.campaignId === campaignId) || [];

  // Fetch videos
  const { data: videos, isLoading: videosLoading } = trpc.videos.list.useQuery({});
  const campaignVideos = videos?.filter((vid) => vid.campaignId === campaignId) || [];

  // Bulk download mutation
  const downloadAll = trpc.campaigns.downloadAllCreatives.useMutation();

  const handleBulkDownload = async () => {
    try {
      setIsDownloading(true);
      
      // Get all creative URLs from backend
      const result = await downloadAll.mutateAsync({ campaignId });
      
      // Create ZIP file
      const zip = new JSZip();
      
      // Download and add images to ZIP
      for (const image of result.images) {
        try {
          const response = await fetch(image.url);
          const blob = await response.blob();
          zip.file(`images/${image.filename}`, blob);
        } catch (err) {
          console.error(`Failed to download image ${image.id}:`, err);
        }
      }
      
      // Download and add videos to ZIP
      for (const video of result.videos) {
        try {
          const response = await fetch(video.url);
          const blob = await response.blob();
          zip.file(`videos/${video.filename}`, blob);
        } catch (err) {
          console.error(`Failed to download video ${video.id}:`, err);
        }
      }
      
      // Generate ZIP and trigger download
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${result.campaignName}-creatives.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Download Complete",
        description: `Downloaded ${result.images.length} images and ${result.videos.length} videos`,
      });
    } catch (error) {
      console.error("Bulk download failed:", error);
      toast({
        title: "Download Failed",
        description: "Failed to download creatives. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
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
            No creatives generated yet. Use the "Ad Creatives" generator above to create images and videos.
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
              {campaignImages.map((image) => (
                <Card key={image.id} className="overflow-hidden">
                  <div className="aspect-square relative bg-muted">
                    <img
                      src={image.imageUrl}
                      alt={image.headline}
                      className="w-full h-full object-cover"
                    />
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
                        asChild
                      >
                        <a href={image.imageUrl} download target="_blank">
                          <Download className="w-4 h-4 mr-1" />
                          Download
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
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
              {campaignVideos.map((video) => (
                <Card key={video.id} className="overflow-hidden">
                  <div className="aspect-video relative bg-muted">
                    {video.creatomateStatus === "succeeded" && video.videoUrl ? (
                      <video
                        src={video.videoUrl}
                        className="w-full h-full object-cover"
                        controls
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {video.creatomateStatus === "queued" ||
                        video.creatomateStatus === "rendering" ? (
                          <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        ) : (
                          <span className="text-muted-foreground">
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
                          : video.creatomateStatus === "failed"
                          ? "destructive"
                          : "secondary"
                      }
                      className="text-xs"
                    >
                      {video.creatomateStatus}
                    </Badge>
                    {video.creatomateStatus === "succeeded" && (
                      <>
                        <Badge variant="default" className="text-xs bg-green-600">
                          ✓ Meta Ads Compliant
                        </Badge>
                        <div className="flex gap-2 pt-2">
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
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
