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
import { RegenerateConfirmationDialog } from "@/components/RegenerateConfirmationDialog";
import { useAuth } from "@/_core/hooks/useAuth";

type TabType = "long" | "short" | "beast_mode" | "subheadlines";

export default function HVCOTitlesDetail() {
  const [, params] = useRoute("/hvco-titles/:hvcoSetId");
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<TabType>("long");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [regenerateForm, setRegenerateForm] = useState({
    targetMarket: "",
    hvcoTopic: "",
  });
  const { user } = useAuth();
  
  const hvcoSetId = params?.hvcoSetId || "";

  const { data: titles, isLoading } = trpc.hvco.getBySetId.useQuery({ hvcoSetId });
  const { data: services } = trpc.services.list.useQuery();

  // Update form when titles load - MUST be before early returns
  useEffect(() => {
    if (titles && titles.length > 0) {
      const firstTitle = titles[0];
      setRegenerateForm({
        targetMarket: firstTitle.targetMarket || "",
        hvcoTopic: firstTitle.hvcoTopic || "",
      });
    }
  }, [titles]);
  
  const deleteMutation = trpc.hvco.delete.useMutation({
    onSuccess: () => {
      toast.success("Your Free Opt-In deleted successfully");
      setLocation("/hvco-titles");
    },
    onError: (error) => {
      toast.error(`Failed to delete Your Free Opt-In: ${error.message}`);
    },
  });

  const rateMutation = trpc.hvco.rate.useMutation({
    onSuccess: () => {
      toast.success("Rating updated");
    },
  });

  const favoriteMutation = trpc.hvco.toggleFavorite.useMutation({
    onSuccess: () => {
      toast.success("Favorite updated");
    },
  });

  const generateMoreMutation = trpc.hvco.generate.useMutation({
    onSuccess: () => {
      toast.success("+15 more Free Opt-In titles generated!");
      window.location.reload();
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const handleGenerateMore = () => {
    setShowConfirmDialog(true);
  };

  const confirmGenerateMore = () => {
    if (!titles || titles.length === 0) return;
    
    // Use the stored parameters from any title in the set
    const firstTitle = titles[0];
    if (!firstTitle.serviceId) {
      toast.error("Cannot regenerate: missing service information");
      return;
    }
    
    setShowConfirmDialog(false);
    generateMoreMutation.mutate({
      serviceId: firstTitle.serviceId,
      targetMarket: firstTitle.targetMarket,
      hvcoTopic: firstTitle.hvcoTopic,
    });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const handleDownloadPDF = () => {
    if (!titles || titles.length === 0) return;

    const titlesByTab = {
      long: titles.filter((t) => t.tabType === "long"),
      short: titles.filter((t) => t.tabType === "short"),
      beast_mode: titles.filter((t) => t.tabType === "beast_mode"),
      subheadlines: titles.filter((t) => t.tabType === "subheadlines"),
    };

    const sections = [
      {
        title: "Long Titles",
        content: titlesByTab.long.map(t => t.title),
      },
      {
        title: "Short Titles",
        content: titlesByTab.short.map(t => t.title),
      },
      {
        title: "Advanced Variations",
        content: titlesByTab.beast_mode.map(t => t.title),
      },
      {
        title: "Subheadlines",
        content: titlesByTab.subheadlines.map(t => t.title),
      },
    ];

    exportToPDF({
      title: "Your Free Opt-In",
      subtitle: titles[0]?.targetMarket || "High-Value Content Offer",
      sections,
      metadata: {
        generatedDate: new Date(titles[0]?.createdAt || new Date()).toLocaleDateString(),
        generatorType: "Your Free Opt-In",
      },
    });

    toast.success("PDF downloaded successfully!");
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this HVCO? This action cannot be undone.")) {
      deleteMutation.mutate({ hvcoSetId });
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

  if (!titles || titles.length === 0) {
    return (
      <div className="container py-8">
        <Card className="p-12 text-center">
          <h3 className="text-lg font-semibold mb-2">HVCO Not Found</h3>
          <p className="text-muted-foreground mb-4">
            This HVCO set doesn't exist or has been deleted
          </p>
          <Button onClick={() => setLocation("/hvco-titles")}>
            Back to Your Free Opt-In
          </Button>
        </Card>
      </div>
    );
  }

  const firstTitle = titles[0];
  const service = services?.find((s) => s.id === firstTitle.serviceId);

  // Group titles by tab type
  const titlesByTab = {
    long: titles.filter((t) => t.tabType === "long"),
    short: titles.filter((t) => t.tabType === "short"),
    beast_mode: titles.filter((t) => t.tabType === "beast_mode"),
    subheadlines: titles.filter((t) => t.tabType === "subheadlines"),
  };

  const handleRegenerate = () => {
    if (!firstTitle?.serviceId) {
      toast.error("Cannot regenerate: missing service information");
      return;
    }
    generateMoreMutation.mutate({
      serviceId: firstTitle.serviceId,
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

      {/* HVCO Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Free Opt-In #{hvcoSetId.slice(0, 8)}
          </h2>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => rateMutation.mutate({ titleId: firstTitle.id, rating: 1 })}
            >
              <ThumbsUp className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => rateMutation.mutate({ titleId: firstTitle.id, rating: -1 })}
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

        {/* Topic & Target Market */}
        <div className="space-y-3 mb-6">
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-1">Topic</h3>
            <p className="text-lg font-medium">{firstTitle.hvcoTopic}</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-1">Target Market</h3>
            <p className="text-sm">{firstTitle.targetMarket}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabType)}>
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="long">Long Titles</TabsTrigger>
          <TabsTrigger value="short">Short Titles</TabsTrigger>
          <TabsTrigger value="beast_mode">Advanced Variations</TabsTrigger>
          <TabsTrigger value="subheadlines">Subheadlines</TabsTrigger>
        </TabsList>

        {/* Long Titles Tab */}
        <TabsContent value="long" className="space-y-3">
          {titlesByTab.long.map((title) => (
            <Card key={title.id} className="p-4 hover:border-primary/50 transition-colors">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <button
                    onClick={() => favoriteMutation.mutate({ 
                      titleId: title.id, 
                      isFavorite: !title.isFavorite 
                    })}
                    className="flex-shrink-0"
                  >
                    <Star 
                      className={`w-5 h-5 ${title.isFavorite ? 'fill-yellow-500 text-yellow-500' : 'text-muted-foreground'}`}
                    />
                  </button>
                  <p className="text-lg font-medium flex-1">{title.title}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopy(title.title)}
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
            </Card>
          ))}
        </TabsContent>

        {/* Short Titles Tab */}
        <TabsContent value="short" className="space-y-3">
          {titlesByTab.short.map((title) => (
            <Card key={title.id} className="p-4 hover:border-primary/50 transition-colors">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <button
                    onClick={() => favoriteMutation.mutate({ 
                      titleId: title.id, 
                      isFavorite: !title.isFavorite 
                    })}
                    className="flex-shrink-0"
                  >
                    <Star 
                      className={`w-5 h-5 ${title.isFavorite ? 'fill-yellow-500 text-yellow-500' : 'text-muted-foreground'}`}
                    />
                  </button>
                  <p className="text-lg font-medium flex-1">{title.title}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopy(title.title)}
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
            </Card>
          ))}
        </TabsContent>

        {/* Advanced Variations Tab */}
        <TabsContent value="beast_mode" className="space-y-3">
          {titlesByTab.beast_mode.map((title) => (
            <Card key={title.id} className="p-4 hover:border-primary/50 transition-colors">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <button
                    onClick={() => favoriteMutation.mutate({ 
                      titleId: title.id, 
                      isFavorite: !title.isFavorite 
                    })}
                    className="flex-shrink-0"
                  >
                    <Star 
                      className={`w-5 h-5 ${title.isFavorite ? 'fill-yellow-500 text-yellow-500' : 'text-muted-foreground'}`}
                    />
                  </button>
                  <p className="text-lg font-medium flex-1">{title.title}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopy(title.title)}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-primary hover:bg-primary/90"
                    onClick={handleGenerateMore}
                    disabled={generateMoreMutation.isPending}
                  >
                    {generateMoreMutation.isPending ? "Generating..." : "+15 More Like This"}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </TabsContent>

        {/* Subheadlines Tab */}
        <TabsContent value="subheadlines" className="space-y-3">
          {titlesByTab.subheadlines.map((title) => (
            <Card key={title.id} className="p-4 hover:border-primary/50 transition-colors">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <button
                    onClick={() => favoriteMutation.mutate({ 
                      titleId: title.id, 
                      isFavorite: !title.isFavorite 
                    })}
                    className="flex-shrink-0"
                  >
                    <Star 
                      className={`w-5 h-5 ${title.isFavorite ? 'fill-yellow-500 text-yellow-500' : 'text-muted-foreground'}`}
                    />
                  </button>
                  <p className="text-lg font-medium flex-1">{title.title}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopy(title.title)}
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
            </Card>
          ))}
        </TabsContent>
      </Tabs>
      </div>

      {/* Regenerate Sidebar */}
      <RegenerateSidebar
        title="Regenerate Your Free Opt-In"
        subtitle="Submit or modify the pre-filled form below to regenerate a similar set of HVCO titles"
        onRegenerate={handleRegenerate}
        isLoading={generateMoreMutation.isPending}
        creditText="Uses 1 HVCO Title Credit"
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="targetMarket">Target Market*</Label>
            <Input
              id="targetMarket"
              value={regenerateForm.targetMarket}
              onChange={(e) => setRegenerateForm({ ...regenerateForm, targetMarket: e.target.value })}
              placeholder="e.g., Busy entrepreneurs"
            />
          </div>
          <div>
            <Label htmlFor="hvcoTopic">HVCO Topic*</Label>
            <Textarea
              id="hvcoTopic"
              value={regenerateForm.hvcoTopic}
              onChange={(e) => setRegenerateForm({ ...regenerateForm, hvcoTopic: e.target.value })}
              placeholder="e.g., Lead generation strategies"
            />
          </div>
        </div>
      </RegenerateSidebar>

      {/* Regenerate Confirmation Dialog */}
      <RegenerateConfirmationDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        onConfirm={confirmGenerateMore}
        generatorName="Your Free Opt-In"
        currentCount={user?.hvcoGeneratedCount || 0}
        limit={user?.role === "superuser" ? Infinity : (user?.subscriptionTier === "agency" ? 999 : user?.subscriptionTier === "pro" ? 3 : 0)}
        resetDate={undefined}
        isLoading={generateMoreMutation.isPending}
      />
      </div>
    </div>
  );
}
