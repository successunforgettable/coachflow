import { Button } from "./ui/button";
import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "../hooks/use-toast";

interface DownloadVideoButtonProps {
  videoUrl: string;
  videoTitle: string;
  className?: string;
}

export function DownloadVideoButton({
  videoUrl,
  videoTitle,
  className,
}: DownloadVideoButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();

  const handleDownload = async () => {
    setIsDownloading(true);

    try {
      // Fetch the video as a blob
      const response = await fetch(videoUrl);
      
      if (!response.ok) {
        throw new Error("Failed to fetch video");
      }

      const blob = await response.blob();
      
      // Create a temporary download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      
      // Generate filename from title (sanitize for filesystem)
      const sanitizedTitle = videoTitle
        .replace(/[^a-z0-9]/gi, "_")
        .toLowerCase();
      link.download = `${sanitizedTitle}_${Date.now()}.mp4`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Download started",
        description: "Your video is being downloaded",
      });
    } catch (error: any) {
      console.error("Download error:", error);
      toast({
        title: "Download failed",
        description: error.message || "Failed to download video",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Button
      onClick={handleDownload}
      disabled={isDownloading}
      variant="outline"
      className={className}
    >
      {isDownloading ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Downloading...
        </>
      ) : (
        <>
          <Download className="w-4 h-4 mr-2" />
          Download MP4
        </>
      )}
    </Button>
  );
}
