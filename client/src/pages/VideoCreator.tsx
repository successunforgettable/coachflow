import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Video, Sparkles, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function VideoCreator() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [serviceId, setServiceId] = useState<string>("");
  const [videoType, setVideoType] = useState<"explainer" | "proof_results" | "testimonial" | "mechanism_reveal">("explainer");
  const [duration, setDuration] = useState<"15" | "30" | "60" | "90">("30");
  const [visualStyle, setVisualStyle] = useState<"text_only" | "kinetic_typography" | "motion_graphics" | "stats_card">("text_only");

  const { data: services } = trpc.services.list.useQuery();
  const { data: balance } = trpc.videoCredits.getBalance.useQuery();
  const generateScript = trpc.videoScripts.generate.useMutation();

  const creditCost = duration === "15" || duration === "30" ? 1 : duration === "60" ? 2 : 3;

  const handleGenerateScript = async () => {
    if (!serviceId) {
      toast({
        title: "Service Required",
        description: "Please select a service to generate a video script.",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await generateScript.mutateAsync({
        serviceId: parseInt(serviceId),
        videoType,
        duration,
        visualStyle,
      });

      toast({
        title: "Script Generated!",
        description: "Your video script is ready for editing.",
      });

      // Navigate to script editor
      setLocation(`/video-creator/script/${result.scriptId}`);
    } catch (error: any) {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate script. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
          <Video className="w-10 h-10 text-purple-500" />
          Video Creator
        </h1>
        <p className="text-muted-foreground text-lg">
          Generate AI-powered video ads with voiceover and motion graphics
        </p>
      </div>

      {/* Credit Balance Card */}
      <Card className="mb-6 border-purple-500/20 bg-purple-500/5">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className="w-6 h-6 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Video Credits</p>
                <p className="text-2xl font-bold">{balance?.balance || 0}</p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => setLocation("/video-credits")}
            >
              Buy More Credits
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Setup Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            Step 1: Video Setup
          </CardTitle>
          <CardDescription>
            Choose your service, video type, and duration. Script generation is FREE — credits are only used when you render the final video.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Service Selection */}
          <div className="space-y-2">
            <Label htmlFor="service">Select Service *</Label>
            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger id="service">
                <SelectValue placeholder="Choose a service..." />
              </SelectTrigger>
              <SelectContent>
                {services?.map((service) => (
                  <SelectItem key={service.id} value={service.id.toString()}>
                    {service.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              The AI will use this service's details to generate your video script
            </p>
          </div>

          {/* Video Type */}
          <div className="space-y-2">
            <Label htmlFor="videoType">Video Type *</Label>
            <Select value={videoType} onValueChange={(value) => setVideoType(value as typeof videoType)}>
              <SelectTrigger id="videoType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="explainer">
                  <div>
                    <div className="font-medium">Explainer</div>
                    <div className="text-sm text-muted-foreground">Problem → Solution → How It Works → CTA</div>
                  </div>
                </SelectItem>
                <SelectItem value="proof_results">
                  <div>
                    <div className="font-medium">Proof & Results</div>
                    <div className="text-sm text-muted-foreground">Results, testimonials, before/after</div>
                  </div>
                </SelectItem>
                <SelectItem value="testimonial">
                  <div>
                    <div className="font-medium">Testimonial</div>
                    <div className="text-sm text-muted-foreground">Customer success story</div>
                  </div>
                </SelectItem>
                <SelectItem value="mechanism_reveal">
                  <div>
                    <div className="font-medium">Mechanism Reveal</div>
                    <div className="text-sm text-muted-foreground">How the product works (unique mechanism)</div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Visual Style */}
          <div className="space-y-2">
            <Label htmlFor="visualStyle">Visual Style *</Label>
            <Select value={visualStyle} onValueChange={(value) => setVisualStyle(value as typeof visualStyle)}>
              <SelectTrigger id="visualStyle">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text_only">
                  <div>
                    <div className="font-medium">Text Only (Recommended)</div>
                    <div className="text-sm text-muted-foreground">Black background, white bold text — highest converting format</div>
                  </div>
                </SelectItem>
                <SelectItem value="kinetic_typography">
                  <div>
                    <div className="font-medium">Kinetic Typography</div>
                    <div className="text-sm text-muted-foreground">Text animates word by word — clean & professional</div>
                  </div>
                </SelectItem>
                <SelectItem value="motion_graphics">
                  <div>
                    <div className="font-medium">Motion Graphics</div>
                    <div className="text-sm text-muted-foreground">Animated shapes & icons — dynamic & energetic</div>
                  </div>
                </SelectItem>
                <SelectItem value="stats_card">
                  <div>
                    <div className="font-medium">Stats Card</div>
                    <div className="text-sm text-muted-foreground">Large numbers with counting animation — high impact</div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Choose the visual template for your video (can't be changed after script generation)
            </p>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label htmlFor="duration">Video Duration *</Label>
            <Select value={duration} onValueChange={(value) => setDuration(value as typeof duration)}>
              <SelectTrigger id="duration">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">
                  <div className="flex items-center justify-between w-full gap-4">
                    <span>15 seconds</span>
                    <span className="text-sm text-muted-foreground">1 credit</span>
                  </div>
                </SelectItem>
                <SelectItem value="30">
                  <div className="flex items-center justify-between w-full gap-4">
                    <span>30 seconds</span>
                    <span className="text-sm text-muted-foreground">1 credit</span>
                  </div>
                </SelectItem>
                <SelectItem value="60">
                  <div className="flex items-center justify-between w-full gap-4">
                    <span>60 seconds</span>
                    <span className="text-sm text-muted-foreground">2 credits</span>
                  </div>
                </SelectItem>
                <SelectItem value="90">
                  <div className="flex items-center justify-between w-full gap-4">
                    <span>90 seconds</span>
                    <span className="text-sm text-muted-foreground">3 credits</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Longer videos cost more credits when rendered (script generation is always free)
            </p>
          </div>

          {/* Generate Button */}
          <div className="pt-4">
            <Button
              onClick={handleGenerateScript}
              disabled={!serviceId || generateScript.isPending}
              className="w-full"
              size="lg"
            >
              {generateScript.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Script...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Script (Free)
                </>
              )}
            </Button>
            <p className="text-sm text-center text-muted-foreground mt-2">
              No credits charged yet — you'll review and edit the script before rendering
            </p>
          </div>
        </CardContent>
      </Card>

      {/* How It Works */}
      <Card className="mt-6 border-muted">
        <CardHeader>
          <CardTitle className="text-lg">How Video Creator Works</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-bold">
                1
              </span>
              <div>
                <strong>Generate Script (Free):</strong> AI creates a scene-by-scene video script based on your service
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-bold">
                2
              </span>
              <div>
                <strong>Edit & Customize:</strong> Review the script, edit any scene, adjust timing or text
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-bold">
                3
              </span>
              <div>
                <strong>Render Video ({creditCost} credit{creditCost > 1 ? "s" : ""}):</strong> Choose a visual style, generate voiceover + motion graphics
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-bold">
                4
              </span>
              <div>
                <strong>Download or Publish:</strong> Get your MP4 file or send directly to Meta Ads Manager
              </div>
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
