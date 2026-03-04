import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FolderIcon, ThumbsUp, ThumbsDown, Download, Trash2, Copy, Star } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { exportToPDF } from "@/lib/pdfExport";
import RegenerateSidebar from "@/components/RegenerateSidebar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RegenerateConfirmationDialog } from "@/components/RegenerateConfirmationDialog";
import { useAuth } from "@/_core/hooks/useAuth";

type TabType = "hero_mechanisms" | "headline_ideas" | "beast_mode";

export default function HeroMechanismsDetail() {
  const [, params] = useRoute("/hero-mechanisms/:mechanismSetId");
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<TabType>("hero_mechanisms");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [regenerateForm, setRegenerateForm] = useState({
    targetMarket: "",
    pressingProblem: "",
    whyProblem: "",
    whatTried: "",
    whyExistingNotWork: "",
    descriptor: "Strategy",
    application: "10 Drops",
    desiredOutcome: "",
    credibility: "",
    socialProof: "",
  });
  const { user } = useAuth();
  
  const mechanismSetId = params?.mechanismSetId || "";

  const { data: mechanisms, isLoading } = trpc.heroMechanisms.getBySetId.useQuery({ mechanismSetId });
  const { data: services } = trpc.services.list.useQuery();

  // Update form when mechanisms load - MUST be before early returns
  useEffect(() => {
    if (mechanisms && mechanisms.length > 0) {
      const firstMechanism = mechanisms[0];
      setRegenerateForm({
        targetMarket: firstMechanism.targetMarket || "",
        pressingProblem: firstMechanism.pressingProblem || "",
        whyProblem: firstMechanism.whyProblem || "",
        whatTried: firstMechanism.whatTried || "",
        whyExistingNotWork: firstMechanism.whyExistingNotWork || "",
        descriptor: firstMechanism.descriptor || "Strategy",
        application: firstMechanism.application || "10 Drops",
        desiredOutcome: firstMechanism.desiredOutcome || "",
        credibility: firstMechanism.credibility || "",
        socialProof: firstMechanism.socialProof || "",
      });
    }
  }, [mechanisms]);
  
  const deleteMutation = trpc.heroMechanisms.delete.useMutation({
    onSuccess: () => {
      toast.success("Your Unique Method deleted successfully");
      setLocation("/hero-mechanisms");
    },
    onError: (error) => {
      toast.error(`Failed to delete Your Unique Method: ${error.message}`);
    },
  });

  const rateMutation = trpc.heroMechanisms.rate.useMutation({
    onSuccess: () => {
      toast.success("Rating updated");
    },
  });

  const favoriteMutation = trpc.heroMechanisms.toggleFavorite.useMutation({
    onSuccess: () => {
      toast.success("Favorite updated");
    },
  });

  const generateMoreMutation = trpc.heroMechanisms.generate.useMutation({
    onSuccess: () => {
      toast.success("Generated 15 more Your Unique Method!");
      // Refresh the data
      window.location.reload();
    },
    onError: (error) => {
      toast.error(`Failed to generate more: ${error.message}`);
    },
  });

  const handleGenerateMore = () => {
    setShowConfirmDialog(true);
  };

  const confirmGenerateMore = () => {
    if (!mechanisms || mechanisms.length === 0) return;
    
    const firstMechanism = mechanisms[0];
    
    // Extract all 11 generation parameters from the first mechanism
    // serviceId is required by the mutation, so we need to handle null case
    if (!firstMechanism.serviceId) {
      toast.error("Cannot regenerate: No service associated with this mechanism");
      return;
    }
    
    setShowConfirmDialog(false);
    generateMoreMutation.mutate({
      targetMarket: firstMechanism.targetMarket,
      pressingProblem: firstMechanism.pressingProblem,
      whyProblem: firstMechanism.whyProblem,
      whatTried: firstMechanism.whatTried,
      whyExistingNotWork: firstMechanism.whyExistingNotWork,
      descriptor: firstMechanism.descriptor || "",
      application: firstMechanism.application || "",
      desiredOutcome: firstMechanism.desiredOutcome,
      credibility: firstMechanism.credibility,
      socialProof: firstMechanism.socialProof,
      serviceId: firstMechanism.serviceId,
    });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const handleDownloadPDF = () => {
    if (!mechanisms || mechanisms.length === 0) return;

    const mechanismsByTab = {
      hero: mechanisms.filter((m) => m.tabType === "hero_mechanisms"),
      headlines: mechanisms.filter((m) => m.tabType === "headline_ideas"),
      beast: mechanisms.filter((m) => m.tabType === "beast_mode"),
    };

    const sections = [
      {
        title: "Your Unique Method",
        content: mechanismsByTab.hero.map(m => `${m.mechanismName}\n${m.mechanismDescription}`),
      },
      {
        title: "Headline Ideas",
        content: mechanismsByTab.headlines.map(m => `${m.mechanismName}\n${m.mechanismDescription}`),
      },
      {
        title: "Advanced options",
        content: mechanismsByTab.beast.map(m => `${m.mechanismName}\n${m.mechanismDescription}`),
      },
    ];

    exportToPDF({
      title: "Your Unique Method",
      subtitle: mechanisms[0]?.targetMarket || "Product Mechanisms",
      sections,
      metadata: {
        generatedDate: new Date(mechanisms[0]?.createdAt || new Date()).toLocaleDateString(),
        generatorType: "Your Unique Method",
      },
    });

    toast.success("PDF downloaded successfully!");
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this Your Unique Method set? This action cannot be undone.")) {
      deleteMutation.mutate({ mechanismSetId });
    }
  };

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-muted rounded" />
          <div className="h-40 bg-muted rounded" />
          <div className="h-96 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!mechanisms || mechanisms.length === 0) {
    return (
      <div className="container py-8">
        <Card className="p-12 text-center">
          <h3 className="text-lg font-semibold mb-2">Your Unique Method Not Found</h3>
          <p className="text-muted-foreground mb-4">
            This Your Unique Method set doesn't exist or has been deleted
          </p>
          <Button onClick={() => setLocation("/hero-mechanisms")}>
            Back to Your Unique Method
          </Button>
        </Card>
      </div>
    );
  }

  const firstMechanism = mechanisms[0];
  const service = services?.find((s) => s.id === firstMechanism.serviceId);

  const mechanismsByTab = {
    hero_mechanisms: mechanisms.filter((m) => m.tabType === "hero_mechanisms"),
    headline_ideas: mechanisms.filter((m) => m.tabType === "headline_ideas"),
    beast_mode: mechanisms.filter((m) => m.tabType === "beast_mode"),
  };

  const handleRegenerate = () => {
    if (!firstMechanism?.serviceId) {
      toast.error("Cannot regenerate: missing service information");
      return;
    }
    generateMoreMutation.mutate({
      serviceId: firstMechanism.serviceId,
      ...regenerateForm,
    });
  };

  return (
    <div className="container py-8">
      <div className="flex gap-6">
      <div className="flex-1">
      {/* Product Card */}
      {service && (
        <Card className="p-6 mb-6 bg-card">
          <div className="flex items-start gap-4">
            <FolderIcon className="w-8 h-8 text-primary flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-2">{service.name}</h3>
              <p className="text-sm text-muted-foreground">
                {service.description}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Your Unique Method Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Your Unique Method #{mechanismSetId.slice(0, 8)}
          </h2>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => rateMutation.mutate({ mechanismId: firstMechanism.id, rating: 1 })}
            >
              <ThumbsUp className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => rateMutation.mutate({ mechanismId: firstMechanism.id, rating: -1 })}
            >
              <ThumbsDown className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              className="bg-primary hover:bg-primary/90"
              onClick={handleDownloadPDF}
            >
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Context Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-1">Target Market</h3>
            <p className="text-sm">{firstMechanism.targetMarket}</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-1">The result your customer wants</h3>
            <p className="text-sm">{firstMechanism.desiredOutcome}</p>
          </div>
          <div className="md:col-span-2">
            <h3 className="text-sm font-semibold text-muted-foreground mb-1">The main problem you solve</h3>
            <p className="text-sm">{firstMechanism.pressingProblem}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabType)}>
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="hero_mechanisms">Your Unique Method</TabsTrigger>
          <TabsTrigger value="headline_ideas">Headline Ideas</TabsTrigger>
          <TabsTrigger value="beast_mode">Advanced options</TabsTrigger>
        </TabsList>

        {/* Your Unique Method Tab */}
        <TabsContent value="hero_mechanisms" className="space-y-4">
          {mechanismsByTab.hero_mechanisms.map((mechanism) => (
            <Card key={mechanism.id} className="p-6 hover:border-primary/50 transition-colors">
              <div className="flex items-start gap-4">
                <button
                  onClick={() => favoriteMutation.mutate({ 
                    mechanismId: mechanism.id, 
                    isFavorite: !mechanism.isFavorite 
                  })}
                  className="flex-shrink-0 mt-1"
                >
                  <Star 
                    className={`w-5 h-5 ${mechanism.isFavorite ? 'fill-yellow-500 text-yellow-500' : 'text-muted-foreground'}`}
                  />
                </button>
                <div className="flex-1 space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Your Unique Method</p>
                    <h3 className="text-xl font-bold mb-2">{mechanism.mechanismName}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {mechanism.mechanismDescription}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopy(mechanism.mechanismName + "\n\n" + mechanism.mechanismDescription)}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </Button>
                    <Button
                      size="sm"
                      className="bg-primary hover:bg-primary/90"
                      onClick={handleGenerateMore}
                      disabled={generateMoreMutation.isPending}
                    >
                      {generateMoreMutation.isPending ? "Generating..." : "+15 More Like This"}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </TabsContent>

        {/* Headline Ideas Tab */}
        <TabsContent value="headline_ideas" className="space-y-4">
          {mechanismsByTab.headline_ideas.map((mechanism) => (
            <Card key={mechanism.id} className="p-6 hover:border-primary/50 transition-colors">
              <div className="flex items-start gap-4">
                <button
                  onClick={() => favoriteMutation.mutate({ 
                    mechanismId: mechanism.id, 
                    isFavorite: !mechanism.isFavorite 
                  })}
                  className="flex-shrink-0 mt-1"
                >
                  <Star 
                    className={`w-5 h-5 ${mechanism.isFavorite ? 'fill-yellow-500 text-yellow-500' : 'text-muted-foreground'}`}
                  />
                </button>
                <div className="flex-1 space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Headline Idea</p>
                    <h3 className="text-xl font-bold mb-2">{mechanism.mechanismName}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {mechanism.mechanismDescription}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopy(mechanism.mechanismName + "\n\n" + mechanism.mechanismDescription)}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </Button>
                    <Button
                      size="sm"
                      className="bg-primary hover:bg-primary/90"
                      onClick={handleGenerateMore}
                      disabled={generateMoreMutation.isPending}
                    >
                      {generateMoreMutation.isPending ? "Generating..." : "+15 More Like This"}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </TabsContent>

        {/* Power Mode Tab */}
        <TabsContent value="beast_mode" className="space-y-4">
          {mechanismsByTab.beast_mode.map((mechanism) => (
            <Card key={mechanism.id} className="p-6 hover:border-primary/50 transition-colors">
              <div className="flex items-start gap-4">
                <button
                  onClick={() => favoriteMutation.mutate({ 
                    mechanismId: mechanism.id, 
                    isFavorite: !mechanism.isFavorite 
                  })}
                  className="flex-shrink-0 mt-1"
                >
                  <Star 
                    className={`w-5 h-5 ${mechanism.isFavorite ? 'fill-yellow-500 text-yellow-500' : 'text-muted-foreground'}`}
                  />
                </button>
                <div className="flex-1 space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Advanced Variation</p>
                    <h3 className="text-xl font-bold mb-2">{mechanism.mechanismName}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {mechanism.mechanismDescription}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopy(mechanism.mechanismName + "\n\n" + mechanism.mechanismDescription)}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </Button>
                    <Button
                      size="sm"
                      className="bg-primary hover:bg-primary/90"
                      onClick={handleGenerateMore}
                      disabled={generateMoreMutation.isPending}
                    >
                      {generateMoreMutation.isPending ? "Generating..." : "+15 More Like This"}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
      </div>

      {/* Regenerate Sidebar */}
      <RegenerateSidebar
        title="Regenerate Your Unique Method"
        subtitle="Submit or modify the pre-filled form below to regenerate a similar set of Unique Methods"
        onRegenerate={handleRegenerate}
        isLoading={generateMoreMutation.isPending}
        creditText="Uses 1 Your Unique Method Credit"
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="targetMarket">Target Market*</Label>
            <Input
              id="targetMarket"
              value={regenerateForm.targetMarket}
              onChange={(e) => setRegenerateForm({ ...regenerateForm, targetMarket: e.target.value })}
              maxLength={52}
              placeholder="e.g., Busy entrepreneurs"
            />
          </div>
          <div>
            <Label htmlFor="pressingProblem">The main problem you solve*</Label>
            <Textarea
              id="pressingProblem"
              value={regenerateForm.pressingProblem}
              onChange={(e) => setRegenerateForm({ ...regenerateForm, pressingProblem: e.target.value })}
              maxLength={71}
              placeholder="e.g., Struggling to generate leads"
            />
          </div>
          <div>
            <Label htmlFor="whyProblem">Why does prospect have this problem?*</Label>
            <Textarea
              id="whyProblem"
              value={regenerateForm.whyProblem}
              onChange={(e) => setRegenerateForm({ ...regenerateForm, whyProblem: e.target.value })}
              maxLength={151}
              placeholder="e.g., Traditional methods are outdated"
            />
          </div>
          <div>
            <Label htmlFor="whatTried">What other solutions tried?*</Label>
            <Textarea
              id="whatTried"
              value={regenerateForm.whatTried}
              onChange={(e) => setRegenerateForm({ ...regenerateForm, whatTried: e.target.value })}
              maxLength={138}
              placeholder="e.g., Facebook ads, cold calling"
            />
          </div>
          <div>
            <Label htmlFor="whyExistingNotWork">Why don't existing solutions work?*</Label>
            <Textarea
              id="whyExistingNotWork"
              value={regenerateForm.whyExistingNotWork}
              onChange={(e) => setRegenerateForm({ ...regenerateForm, whyExistingNotWork: e.target.value })}
              maxLength={137}
              placeholder="e.g., Too expensive, too time-consuming"
            />
          </div>
          <div>
            <Label htmlFor="descriptor">Descriptor</Label>
            <Select value={regenerateForm.descriptor} onValueChange={(value) => setRegenerateForm({ ...regenerateForm, descriptor: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Strategy">Strategy</SelectItem>
                <SelectItem value="Framework">Framework</SelectItem>
                <SelectItem value="Method">Method</SelectItem>
                <SelectItem value="System">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="application">How is it applied?</Label>
            <Select value={regenerateForm.application} onValueChange={(value) => setRegenerateForm({ ...regenerateForm, application: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10 Drops">10 Drops</SelectItem>
                <SelectItem value="Apply 2 drops">Apply 2 drops</SelectItem>
                <SelectItem value="Spend 30 seconds">Spend 30 seconds</SelectItem>
                <SelectItem value="Spend 5 minutes">Spend 5 minutes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="desiredOutcome">The result your customer wants*</Label>
            <Textarea
              id="desiredOutcome"
              value={regenerateForm.desiredOutcome}
              onChange={(e) => setRegenerateForm({ ...regenerateForm, desiredOutcome: e.target.value })}
              maxLength={116}
              placeholder="e.g., 10x more qualified leads"
            />
          </div>
          <div>
            <Label htmlFor="credibility">Your credentials*</Label>
            <Input
              id="credibility"
              value={regenerateForm.credibility}
              onChange={(e) => setRegenerateForm({ ...regenerateForm, credibility: e.target.value })}
              maxLength={22}
              placeholder="e.g., Dr. Smith"
            />
          </div>
          <div>
            <Label htmlFor="socialProof">Reviews and results*</Label>
            <Input
              id="socialProof"
              value={regenerateForm.socialProof}
              onChange={(e) => setRegenerateForm({ ...regenerateForm, socialProof: e.target.value })}
              maxLength={24}
              placeholder="e.g., 10,000+ users"
            />
          </div>
          <div className="text-xs text-muted-foreground italic">
            ⚠️ Your Unique Method are AI-generated and should be reviewed before use
          </div>
        </div>
      </RegenerateSidebar>

      {/* Regenerate Confirmation Dialog */}
      <RegenerateConfirmationDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        onConfirm={confirmGenerateMore}
        generatorName="Your Unique Method"
        currentCount={user?.heroMechanismGeneratedCount || 0}
        limit={user?.role === "superuser" ? Infinity : (user?.subscriptionTier === "agency" ? 999 : user?.subscriptionTier === "pro" ? 4 : 0)}
        resetDate={undefined}
        isLoading={generateMoreMutation.isPending}
      />
      </div>
    </div>
  );
}
