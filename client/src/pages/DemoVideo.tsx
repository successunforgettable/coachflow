import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Download, Play, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function DemoVideo() {
  const { toast } = useToast();
  const [selectedVideoId, setSelectedVideoId] = useState<number | null>(null);

  const { data: demoVideos, isLoading: isLoadingList, refetch } = trpc.demoVideos.listDemoVideos.useQuery();
  const { data: selectedVideo } = trpc.demoVideos.getDemoVideo.useQuery(
    { id: selectedVideoId! },
    { enabled: !!selectedVideoId }
  );

  const generateMutation = trpc.demoVideos.generateDemoVideo.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Demo video generation started",
        description: "Your ZAP flagship demo is being rendered. This will take 2-5 minutes.",
      });
      setSelectedVideoId(data.demoVideoId);
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Generation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const checkStatusMutation = trpc.demoVideos.checkStatus.useMutation({
    onSuccess: (data) => {
      refetch();
      if (data.status === "succeeded") {
        toast({
          title: "Video ready!",
          description: "Your ZAP demo video has finished rendering.",
        });
      } else if (data.status === "failed") {
        toast({
          title: "Render failed",
          description: "The video render encountered an error.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Status updated",
          description: `Current status: ${data.status}`,
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Status check failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleGenerate = () => {
    generateMutation.mutate(undefined);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "succeeded":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "rendering":
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "succeeded":
        return "Completed";
      case "failed":
        return "Failed";
      case "rendering":
        return "Rendering...";
      default:
        return "Queued";
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">ZAP Demo Video</h1>
          <p className="text-muted-foreground mt-2">
            Generate the flagship ZAP demo video with hardcoded script, Josh voice, and premium production quality.
          </p>
        </div>

        {/* Generate Button */}
        <Card>
          <CardHeader>
            <CardTitle>Generate New Demo</CardTitle>
            <CardDescription>
              Create a 30-second flagship demo video showcasing ZAP's value proposition to coaches.
              Features Josh voice, radial gradient background, brand color accents, and background music.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
              size="lg"
              className="w-full"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Generate ZAP Demo
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Video List */}
        {isLoadingList ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : demoVideos && demoVideos.length > 0 ? (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Your Demo Videos</h2>
            {demoVideos.map((video) => (
              <Card key={video.id} className={selectedVideoId === video.id ? "border-primary" : ""}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(video.creatomateStatus)}
                      <div>
                        <CardTitle className="text-lg">{video.title}</CardTitle>
                        <CardDescription>{getStatusText(video.creatomateStatus)}</CardDescription>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(video.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </CardHeader>
                
                {/* Rendering Status - Show Check Status Button */}
                {video.creatomateStatus === "rendering" && (
                  <CardContent>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => checkStatusMutation.mutate({ demoVideoId: video.id })}
                      disabled={checkStatusMutation.isPending}
                    >
                      {checkStatusMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Clock className="h-4 w-4 mr-2" />
                      )}
                      Check Status
                    </Button>
                  </CardContent>
                )}
                
                {/* Succeeded Status - Show Video Player and Download */}
                {video.creatomateStatus === "succeeded" && video.videoUrl && (
                  <CardContent className="space-y-4">
                    {/* Video Player */}
                    <video
                      src={video.videoUrl}
                      controls
                      className="w-full rounded-lg bg-black"
                      style={{ maxHeight: "500px" }}
                    />
                    
                    {/* Download Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(video.videoUrl!, "_blank")}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </CardContent>
                )}
                {video.creatomateStatus === "failed" && video.errorMessage && (
                  <CardContent>
                    <div className="text-sm text-red-500">
                      Error: {video.errorMessage}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No demo videos yet. Click "Generate ZAP Demo" to create your first one.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
