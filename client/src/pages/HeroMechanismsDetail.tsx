import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FolderIcon, ThumbsUp, ThumbsDown, Download, Trash2, Copy, Star } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type TabType = "hero_mechanisms" | "headline_ideas" | "beast_mode";

export default function HeroMechanismsDetail() {
  const [, params] = useRoute("/hero-mechanisms/:mechanismSetId");
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<TabType>("hero_mechanisms");
  
  const mechanismSetId = params?.mechanismSetId || "";

  const { data: mechanisms, isLoading } = trpc.heroMechanisms.getBySetId.useQuery({ mechanismSetId });
  const { data: services } = trpc.services.list.useQuery();
  
  const deleteMutation = trpc.heroMechanisms.delete.useMutation({
    onSuccess: () => {
      toast.success("Hero Mechanism deleted successfully");
      setLocation("/hero-mechanisms");
    },
    onError: (error) => {
      toast.error(`Failed to delete Hero Mechanism: ${error.message}`);
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

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const handleDownloadPDF = () => {
    toast.info("PDF export coming soon!");
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this Hero Mechanism set? This action cannot be undone.")) {
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
          <h3 className="text-lg font-semibold mb-2">Hero Mechanism Not Found</h3>
          <p className="text-muted-foreground mb-4">
            This Hero Mechanism set doesn't exist or has been deleted
          </p>
          <Button onClick={() => setLocation("/hero-mechanisms")}>
            Back to Hero Mechanisms
          </Button>
        </Card>
      </div>
    );
  }

  const firstMechanism = mechanisms[0];
  const service = services?.find((s) => s.id === firstMechanism.serviceId);

  // Group mechanisms by tab type
  const mechanismsByTab = {
    hero_mechanisms: mechanisms.filter((m) => m.tabType === "hero_mechanisms"),
    headline_ideas: mechanisms.filter((m) => m.tabType === "headline_ideas"),
    beast_mode: mechanisms.filter((m) => m.tabType === "beast_mode"),
  };

  return (
    <div className="container py-8">
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

      {/* Hero Mechanism Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Hero Mechanism #{mechanismSetId.slice(0, 8)}
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
            <h3 className="text-sm font-semibold text-muted-foreground mb-1">Desired Outcome</h3>
            <p className="text-sm">{firstMechanism.desiredOutcome}</p>
          </div>
          <div className="md:col-span-2">
            <h3 className="text-sm font-semibold text-muted-foreground mb-1">Pressing Problem</h3>
            <p className="text-sm">{firstMechanism.pressingProblem}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabType)}>
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="hero_mechanisms">Hero Mechanisms</TabsTrigger>
          <TabsTrigger value="headline_ideas">Headline Ideas</TabsTrigger>
          <TabsTrigger value="beast_mode">Beast Mode</TabsTrigger>
        </TabsList>

        {/* Hero Mechanisms Tab */}
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
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Hero Mechanism</p>
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
                    >
                      +15 More Like This
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
                    >
                      +15 More Like This
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </TabsContent>

        {/* Beast Mode Tab */}
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
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Beast Mode Mechanism</p>
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
                    >
                      +15 More Like This
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
