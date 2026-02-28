import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Video, Edit3, Play, ArrowLeft, AlertCircle, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Scene {
  sceneNumber: number;
  duration: number;
  voiceoverText: string;
  visualDirection: string;
  onScreenText: string;
}

export default function VideoScriptEditor() {
  const [, params] = useRoute("/video-creator/script/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const scriptId = params?.id ? parseInt(params.id) : null;
  
  const { data: script, isLoading } = trpc.videoScripts.getById.useQuery(
    { scriptId: scriptId! },
    { enabled: !!scriptId }
  );
  const { data: balance } = trpc.videoCredits.getBalance.useQuery();
  const updateScript = trpc.videoScripts.update.useMutation();
  const generateVideo = trpc.videos.generate.useMutation();

  const [scenes, setScenes] = useState<Scene[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (script?.scenes) {
      setScenes(script.scenes as unknown as Scene[]);
    }
  }, [script]);

  const creditCost = script?.duration === "15" || script?.duration === "30" ? 1 
    : script?.duration === "60" ? 2 : 3;

  const handleSceneChange = (sceneNumber: number, field: keyof Scene, value: string | number) => {
    setScenes(prev => prev.map(scene => 
      scene.sceneNumber === sceneNumber 
        ? { ...scene, [field]: value }
        : scene
    ));
    setHasChanges(true);
  };

  const handleSaveChanges = async () => {
    if (!scriptId) return;

    try {
      await updateScript.mutateAsync({
        scriptId,
        scenes,
      });

      toast({
        title: "Script Saved",
        description: "Your changes have been saved successfully.",
      });
      setHasChanges(false);
    } catch (error: any) {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save changes. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleGenerateVideo = async () => {
    if (!scriptId) return;

    // Check credit balance
    if (!balance || balance.balance < creditCost) {
      toast({
        title: "Insufficient Credits",
        description: `This video requires ${creditCost} credit${creditCost > 1 ? "s" : ""}, but you have ${balance?.balance || 0}. Please purchase more credits.`,
        variant: "destructive",
      });
      setLocation("/video-credits");
      return;
    }

    // Save changes before generating
    if (hasChanges) {
      try {
        await updateScript.mutateAsync({
          scriptId,
          scenes,
        });
      } catch (error: any) {
        toast({
          title: "Save Failed",
          description: "Please save your changes before generating the video.",
          variant: "destructive",
        });
        return;
      }
    }

    try {
      const result = await generateVideo.mutateAsync({
        scriptId,
        visualStyle: script!.visualStyle,
        brandColor: "#8B5CF6", // Default purple
        logoUrl: undefined,
      });

      toast({
        title: "Video Rendering Started!",
        description: "Your video is being generated. This may take 2-5 minutes.",
      });

      // Navigate to video detail page
      setLocation(`/video-creator/video/${result.videoId}`);
    } catch (error: any) {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to start video generation. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="container max-w-6xl py-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      </div>
    );
  }

  if (!script) {
    return (
      <div className="container max-w-6xl py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Script not found. Please generate a new script.
          </AlertDescription>
        </Alert>
        <Button onClick={() => setLocation("/video-creator")} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Video Creator
        </Button>
      </div>
    );
  }

  const totalDuration = scenes.reduce((sum, scene) => sum + scene.duration, 0);

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
          Back to Setup
        </Button>
        <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
          <Edit3 className="w-10 h-10 text-purple-500" />
          Edit Video Script
        </h1>
        <p className="text-muted-foreground text-lg">
          Review and customize your AI-generated script before rendering
        </p>
      </div>

      {/* Script Info Card */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Video Type</p>
              <p className="font-semibold capitalize">{script.videoType.replace(/_/g, " ")}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Duration</p>
              <p className="font-semibold">{script.duration} seconds</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Visual Style</p>
              <p className="font-semibold capitalize">{script.visualStyle.replace(/_/g, " ")}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Credit Cost</p>
              <p className="font-semibold text-purple-500">{creditCost} credit{creditCost > 1 ? "s" : ""}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Meta Compliance Warning */}
      <Alert className="mb-6 border-yellow-500/50 bg-yellow-500/10">
        <AlertCircle className="h-4 w-4 text-yellow-500" />
        <AlertDescription className="text-sm">
          <strong>Meta Compliance:</strong> Avoid prohibited language (banned, forbidden, leaked, exposed, glitch, secret). 
          Do not fabricate statistics or make income guarantees. Keep claims truthful and verifiable.
        </AlertDescription>
      </Alert>

      {/* Scene Editor */}
      <div className="space-y-6">
        {scenes.map((scene) => (
          <Card key={scene.sceneNumber}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <span>Scene {scene.sceneNumber}</span>
                <span className="text-sm font-normal text-muted-foreground">
                  {scene.duration}s
                </span>
              </CardTitle>
              <CardDescription>
                {scene.sceneNumber === 1 && "Hook — Pattern interrupt to stop the scroll"}
                {scene.sceneNumber === 2 && "Problem — Name the pain clearly"}
                {scene.sceneNumber === 3 && "Solution — Introduce the product"}
                {scene.sceneNumber > 3 && "Supporting content and call-to-action"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Voiceover Text */}
              <div>
                <Label htmlFor={`voiceover-${scene.sceneNumber}`}>
                  Voiceover Text (what the AI voice will say)
                </Label>
                <Textarea
                  id={`voiceover-${scene.sceneNumber}`}
                  value={scene.voiceoverText}
                  onChange={(e) => handleSceneChange(scene.sceneNumber, "voiceoverText", e.target.value)}
                  rows={3}
                  className="mt-2"
                  placeholder="Enter the spoken words for this scene..."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Keep it conversational — use contractions and short sentences
                </p>
              </div>

              {/* On-Screen Text */}
              <div>
                <Label htmlFor={`onscreen-${scene.sceneNumber}`}>
                  On-Screen Text (visual overlay)
                </Label>
                <Textarea
                  id={`onscreen-${scene.sceneNumber}`}
                  value={scene.onScreenText}
                  onChange={(e) => handleSceneChange(scene.sceneNumber, "onScreenText", e.target.value)}
                  rows={2}
                  className="mt-2"
                  placeholder="3-7 words maximum — punchy and bold"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Short, impactful text that appears on screen (3-7 words max)
                </p>
              </div>

              {/* Visual Direction */}
              <div>
                <Label htmlFor={`visual-${scene.sceneNumber}`}>
                  Visual Direction (for reference only)
                </Label>
                <Textarea
                  id={`visual-${scene.sceneNumber}`}
                  value={scene.visualDirection}
                  onChange={(e) => handleSceneChange(scene.sceneNumber, "visualDirection", e.target.value)}
                  rows={2}
                  className="mt-2"
                  placeholder="Describe what should appear on screen..."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This helps you visualize the scene — not used in rendering
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Action Bar */}
      <Card className="mt-6 border-purple-500/20 bg-purple-500/5">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Duration: {totalDuration}s</p>
              <p className="text-sm text-muted-foreground">
                Your Balance: <span className="font-bold text-purple-500">{balance?.balance || 0} credits</span>
              </p>
            </div>
            <div className="flex gap-3">
              {hasChanges && (
                <Button
                  variant="outline"
                  onClick={handleSaveChanges}
                  disabled={updateScript.isPending}
                >
                  {updateScript.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              )}
              <Button
                onClick={handleGenerateVideo}
                disabled={generateVideo.isPending || (balance?.balance || 0) < creditCost}
                size="lg"
              >
                {generateVideo.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Video ({creditCost} credit{creditCost > 1 ? "s" : ""})
                  </>
                )}
              </Button>
            </div>
          </div>
          {(balance?.balance || 0) < creditCost && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Insufficient credits. This video requires {creditCost} credit{creditCost > 1 ? "s" : ""}, but you have {balance?.balance || 0}.{" "}
                <Button
                  variant="link"
                  className="p-0 h-auto text-destructive underline"
                  onClick={() => setLocation("/video-credits")}
                >
                  Purchase more credits
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
