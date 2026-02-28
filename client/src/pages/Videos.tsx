import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Video, PlayCircle, Clock, CheckCircle, XCircle } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { useState } from "react";

export default function Videos() {
  const [, setLocation] = useLocation();
  const { data: videos, isLoading } = trpc.videos.list.useQuery({});
  const [searchQuery, setSearchQuery] = useState("");

  const filteredVideos = videos?.filter((video) =>
    (video.title ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (video.angle ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (video.nicheWorld ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    video.visualStyle.toLowerCase().includes(searchQuery.toLowerCase()) ||
    video.videoType.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "succeeded":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "rendering":
      case "queued":
        return <Loader2 className="h-4 w-4 animate-spin text-purple-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "succeeded":
        return "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20";
      case "failed":
        return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
      case "rendering":
      case "queued":
        return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container max-w-7xl py-8">
      {/* Search Bar */}
      <div className="mb-6">
        <SearchBar
          placeholder="Search videos by style or type..."
          value={searchQuery}
          onChange={setSearchQuery}
        />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Video className="w-8 h-8 text-purple-500" />
            My Videos
          </h1>
          <p className="text-muted-foreground mt-2">
            AI-generated video ads ready for Meta campaigns
          </p>
        </div>
        <Button 
          className="bg-purple-600 hover:bg-purple-700"
          onClick={() => setLocation("/video-creator")}
        >
          <Plus className="h-4 w-4 mr-2" />
          Create New Video
        </Button>
      </div>

      {/* Videos Grid */}
      {filteredVideos && filteredVideos.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredVideos.map((video) => (
            <Card key={video.id} className="overflow-hidden hover:border-purple-500/50 transition-colors">
              {/* Thumbnail */}
              <div className="aspect-square bg-black relative group">
                {video.thumbnailUrl ? (
                  <img 
                    src={video.thumbnailUrl} 
                    alt="Video thumbnail"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Video className="w-16 h-16 text-muted-foreground" />
                  </div>
                )}
                {video.creatomateStatus === "succeeded" && (
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <PlayCircle className="w-16 h-16 text-white" />
                  </div>
                )}
                {/* Duration badge */}
                {video.duration && (
                  <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
                    {video.duration}s
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm leading-tight truncate" title={video.title ?? `Video #${video.id}`}>
                      {video.title ?? `Video #${video.id}`}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">#{video.id}</p>
                  </div>
                  <Badge className={getStatusColor(video.creatomateStatus)}>
                    <span className="flex items-center gap-1">
                      {getStatusIcon(video.creatomateStatus)}
                      {video.creatomateStatus}
                    </span>
                  </Badge>
                </div>

                {/* Metadata badges */}
                <div className="flex flex-wrap gap-1">
                  {video.angle && (
                    <span className="text-xs bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full font-medium">
                      {video.angle}
                    </span>
                  )}
                  {video.nicheWorld && (
                    <span className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">
                      {video.nicheWorld}
                    </span>
                  )}
                  {video.wordCount && (
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                      {video.wordCount} words
                    </span>
                  )}
                </div>

                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duration:</span>
                    <span>{video.duration}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type:</span>
                    <span className="capitalize">{video.videoType.replace(/_/g, " ")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created:</span>
                    <span>{new Date(video.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => setLocation(`/video-creator/video/${video.id}`)}
                >
                  {video.creatomateStatus === "succeeded" ? "View & Download" : "View Status"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <Video className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No videos yet</h3>
          <p className="text-muted-foreground mb-6">
            Create your first AI-powered video ad for Meta campaigns
          </p>
          <Button 
            className="bg-purple-600 hover:bg-purple-700"
            onClick={() => setLocation("/video-creator")}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Your First Video
          </Button>
        </Card>
      )}
    </div>
  );
}
