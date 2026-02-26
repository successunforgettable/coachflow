import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Video, Download, ArrowLeft, AlertCircle, RefreshCw, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DownloadVideoButton } from "@/components/DownloadVideoButton";
import { ManualUploadInstructions } from "@/components/ManualUploadInstructions";

export default function VideoDetail() {
  const [, params] = useRoute("/video-creator/video/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const videoId = params?.id ? parseInt(params.id) : null;
  
  const { data: video, isLoading, refetch } = trpc.videos.getById.useQuery(
    { videoId: videoId! },
    { 
      enabled: !!videoId,
      refetchInterval: 5000 // Poll every 5 seconds while rendering
    }
  );

  useEffect(() => {
    if (video?.creatomateStatus === "succeeded") {
      toast({
        title: "Video Ready!",
        description: "Your video has been generated successfully.",
      });
    } else if (video?.creatomateStatus === "failed") {
      toast({
        title: "Video Generation Failed",
        description: "An error occurred during rendering. Your credits have been refunded.",
        variant: "destructive",
      });
    }
  }, [video?.creatomateStatus]);

  if (isLoading) {
    return (
      <div className="container max-w-6xl py-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="container max-w-6xl py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Video not found. Please generate a new video.
          </AlertDescription>
        </Alert>
        <Button onClick={() => setLocation("/video-creator")} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Video Creator
        </Button>
      </div>
    );
  }

  const isRendering = video.creatomateStatus === "rendering" || video.creatomateStatus === "queued";
  const isCompleted = video.creatomateStatus === "succeeded";
  const isFailed = video.creatomateStatus === "failed";

  return (
    <div className="container max-w-6xl py-8">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => setLocation("/video-creator")}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Video Creator
        </Button>
        <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
          <Video className="w-10 h-10 text-purple-500" />
          Your Video
        </h1>
        <p className="text-muted-foreground text-lg">
          {isRendering && "Your video is being generated..."}
          {isCompleted && "Your video is ready to download or publish"}
          {isFailed && "Video generation failed"}
        </p>
      </div>

      {/* Status Card */}
      {isRendering && (
        <Card className="mb-6 border-purple-500/20 bg-purple-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
              <div>
                <p className="font-semibold text-lg">Rendering in Progress...</p>
                <p className="text-sm text-muted-foreground">
                  This usually takes 2-5 minutes. You can close this page and come back later.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => refetch()}
                className="ml-auto"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Status
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isFailed && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Generation Failed:</strong> An unknown error occurred during rendering.
            <br />
            Your {video.creditsUsed} credit{video.creditsUsed > 1 ? "s have" : " has"} been automatically refunded.
          </AlertDescription>
        </Alert>
      )}

      {/* Video Player */}
      {isCompleted && video.videoUrl && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="aspect-square bg-black rounded-lg overflow-hidden">
              <video
                src={video.videoUrl}
                controls
                className="w-full h-full object-contain"
                poster={video.thumbnailUrl || undefined}
              >
                Your browser does not support the video tag.
              </video>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Video Info */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Video Details</CardTitle>
          <CardDescription>
            Meta-compliant video specifications for Facebook and Instagram ads
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <p className="font-semibold capitalize flex items-center gap-2">
                {video.creatomateStatus === "rendering" && <Loader2 className="w-4 h-4 animate-spin" />}
                {video.creatomateStatus}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Duration</p>
              <p className="font-semibold">{video.duration || "N/A"}s</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Resolution</p>
              <p className="font-semibold">1080×1080 (Square)</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Format</p>
              <p className="font-semibold">MP4 (H.264)</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Visual Style</p>
              <p className="font-semibold capitalize">{video.visualStyle.replace(/_/g, " ")}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Credits Used</p>
              <p className="font-semibold text-purple-500">{video.creditsUsed}</p>
            </div>
          </div>
          <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
            <p className="text-sm text-green-600 dark:text-green-400 font-medium">
              ✓ Meta Ads Compliant — Ready for Facebook & Instagram campaigns
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      {isCompleted && video.videoUrl && (
        <>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Download Video</CardTitle>
              <CardDescription>
                Download your video as an MP4 file to use anywhere
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DownloadVideoButton videoUrl={video.videoUrl} videoTitle={`video-${video.id}`} />
            </CardContent>
          </Card>

          <ManualUploadInstructions />

          {/* Future: Send to Meta Ads Manager */}
          <Card className="border-muted">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Send to Meta Ads Manager
                <span className="text-xs bg-yellow-500 text-black px-2 py-0.5 rounded font-normal">
                  Coming Soon
                </span>
              </CardTitle>
              <CardDescription>
                Direct integration with Meta Ads Manager is pending approval (6-8 weeks).
                Use the download button above to upload manually for now.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button disabled variant="outline">
                <ExternalLink className="w-4 h-4 mr-2" />
                Push to Ads Manager (Pending Meta Approval)
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {/* Retry Button for Failed Videos */}
      {isFailed && (
        <Card>
          <CardContent className="pt-6">
            <Button
              onClick={() => setLocation(`/video-creator/script/${video.scriptId}`)}
              className="w-full"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again with Same Script
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
