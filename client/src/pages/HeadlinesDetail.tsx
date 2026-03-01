import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PillTabs, PillTabContent } from "@/components/PillTabs";
import { Switch } from "@/components/ui/switch";
import { Loader2, ArrowLeft, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { exportToPDF } from "@/lib/pdfExport";
import RegenerateSidebar from "@/components/RegenerateSidebar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { RegenerateConfirmationDialog } from "@/components/RegenerateConfirmationDialog";
import { useAuth } from "@/_core/hooks/useAuth";
import { HeadlineCard } from "@/components/HeadlineCard";

export default function HeadlinesDetail() {
  const [, params] = useRoute("/headlines/:id");
  const headlineSetId = params?.id || "";
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const { user: authUser } = useAuth();
  const [regenerateForm, setRegenerateForm] = useState({
    targetMarket: "",
    pressingProblem: "",
    desiredOutcome: "",
    uniqueMechanism: "",
  });

  const { data, isLoading, refetch } = trpc.headlines.getBySetId.useQuery(
    { headlineSetId },
    { enabled: !!headlineSetId }
  );

  const rateMutation = trpc.headlines.rate.useMutation({
    onSuccess: () => {
      toast.success("Rating updated");
      refetch();
    },
  });

  const deleteMutation = trpc.headlines.delete.useMutation({
    onSuccess: () => {
      toast.success("Headlines deleted");
      window.location.href = "/headlines";
    },
  });

  const { data: user } = trpc.auth.me.useQuery();
  
  const togglePowerMode = trpc.auth.toggleBeastMode.useMutation({
    onSuccess: (data: { enabled: boolean }) => {
      toast.success(`Advanced options ${data.enabled ? 'enabled' : 'disabled'}`);
    },
    onError: (error: any) => {
      toast.error(`Failed to toggle advanced options: ${error.message}`);
    },
  });

  const generateMoreMutation = trpc.headlines.generate.useMutation({
    onSuccess: () => {
      toast.success("+15 more headlines generated!");
      refetch();
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Calculate firstHeadline before any early returns
  const firstHeadline = data?.headlines.story[0] || data?.headlines.eyebrow[0] || data?.headlines.question[0] || data?.headlines.authority[0] || data?.headlines.urgency[0];
  
  // Update form with actual data after loading
  useEffect(() => {
    if (firstHeadline) {
      setRegenerateForm({
        targetMarket: firstHeadline.targetMarket || "",
        pressingProblem: firstHeadline.pressingProblem || "",
        desiredOutcome: firstHeadline.desiredOutcome || "",
        uniqueMechanism: firstHeadline.uniqueMechanism || "",
      });
    }
  }, [firstHeadline]);

  const handleGenerateMore = () => {
    setShowConfirmDialog(true);
  };

  const confirmGenerateMore = () => {
    if (!data) return;
    
    // Use the stored parameters from any headline in the set
    const firstHeadline = data.headlines.story[0] || data.headlines.eyebrow[0] || data.headlines.question[0] || data.headlines.authority[0] || data.headlines.urgency[0];
    if (!firstHeadline) return;
    
    setShowConfirmDialog(false);
    generateMoreMutation.mutate({
      serviceId: firstHeadline.serviceId || undefined,
      campaignId: firstHeadline.campaignId || undefined,
      targetMarket: firstHeadline.targetMarket,
      pressingProblem: firstHeadline.pressingProblem,
      desiredOutcome: firstHeadline.desiredOutcome,
      uniqueMechanism: firstHeadline.uniqueMechanism,
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container max-w-7xl py-8">
        <Card className="p-12 text-center">
          <h3 className="text-lg font-semibold mb-2">Headlines not found</h3>
          <Link href="/headlines">
            <Button>Back to Headlines</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const { headlines, metadata } = data;
  const allHeadlines = [
    ...headlines.story,
    ...headlines.eyebrow,
    ...headlines.question,
    ...headlines.authority,
    ...headlines.urgency,
  ];

  const handleDownloadPDF = () => {
    if (!data) return;

    const sections = [
      {
        title: "Story-Based Headlines",
        content: headlines.story.map(h => h.headline),
      },
      {
        title: "Eyebrow Raise Headlines",
        content: headlines.eyebrow.map(h => h.headline),
      },
      {
        title: "Question Headlines",
        content: headlines.question.map(h => h.headline),
      },
      {
        title: "Authority Headlines",
        content: headlines.authority.map(h => h.headline),
      },
      {
        title: "Urgency Headlines",
        content: headlines.urgency.map(h => h.headline),
      },
    ];

    exportToPDF({
      title: "Direct Response Headlines",
      subtitle: "Marketing Headlines",
      sections,
      metadata: {
        generatedDate: new Date(headlines.story[0]?.createdAt || new Date()).toLocaleDateString(),
        generatorType: "Your Headlines",
      },
    });

    toast.success("PDF downloaded successfully!");
  };

  const handleRegenerate = () => {
    generateMoreMutation.mutate({
      serviceId: firstHeadline?.serviceId || undefined,
      campaignId: firstHeadline?.campaignId || undefined,
      ...regenerateForm,
    });
  };

  const handleRate = (headlineId: number, rating: number) => {
    rateMutation.mutate({ headlineId, rating });
  };

  return (
    <div className="container max-w-7xl py-8">
      <div className="flex gap-6">
      {/* Main Content */}
      <div className="flex-1">
      {/* Header */}
      <div className="mb-6">
        <Link href="/headlines">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Headlines
          </Button>
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">Direct Response Headlines</h1>
            <p className="text-muted-foreground mt-2">
              Headline Set #{headlineSetId.slice(-6)}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleDownloadPDF}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
            <Button
              variant="destructive"
              size="icon"
              onClick={() => {
                if (confirm("Delete this headline set?")) {
                  deleteMutation.mutate({ headlineSetId });
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Product Info Card */}
      <Card className="p-6 mb-8">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="font-semibold mb-2">Target Market</h3>
            <p className="text-sm text-muted-foreground">{metadata.targetMarket}</p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">The main problem you solve</h3>
            <p className="text-sm text-muted-foreground">{metadata.pressingProblem}</p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">The result your customer wants</h3>
            <p className="text-sm text-muted-foreground">{metadata.desiredOutcome}</p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Unique Mechanism</h3>
            <p className="text-sm text-muted-foreground">{metadata.uniqueMechanism}</p>
          </div>
        </div>
      </Card>

      {/* KONG-STYLE TABBED INTERFACE */}
      <Card>
        <div className="p-6">
          <PillTabs
            tabs={[
              { id: "all", label: "All", count: allHeadlines.length },
              { id: "story", label: "Story", count: headlines.story.length },
              { id: "eyebrow", label: "Eyebrow", count: headlines.eyebrow.length },
              { id: "question", label: "Question", count: headlines.question.length },
              { id: "authority", label: "Authority", count: headlines.authority.length },
              { id: "urgency", label: "Urgency", count: headlines.urgency.length },
              { id: "powermode", label: "Advanced options" }
            ]}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />

            {/* All Headlines Tab */}
            <PillTabContent value="all" activeTab={activeTab}>
              <div className="space-y-6">
              {headlines.story.length > 0 && (
                <div>
                  <h2 className="text-xl font-bold mb-4">Story-Based Headlines</h2>
                  <div className="space-y-4">
                    {headlines.story.map((headline) => (
                      <HeadlineCard
                        key={headline.id}
                        headline={headline}
                        onRate={handleRate}
                        onCopy={copyToClipboard}
                        onGenerateMore={handleGenerateMore}
                        isGenerating={generateMoreMutation.isPending}
                      />
                    ))}
                  </div>
                </div>
              )}

              {headlines.eyebrow.length > 0 && (
                <div>
                  <h2 className="text-xl font-bold mb-4">Eyebrow + Main + Subheadline</h2>
                  <div className="space-y-4">
                    {headlines.eyebrow.map((headline) => (
                      <HeadlineCard
                        key={headline.id}
                        headline={headline}
                        onRate={handleRate}
                        onCopy={copyToClipboard}
                        onGenerateMore={handleGenerateMore}
                        isGenerating={generateMoreMutation.isPending}
                      />
                    ))}
                  </div>
                </div>
              )}

              {headlines.question.length > 0 && (
                <div>
                  <h2 className="text-xl font-bold mb-4">Question Headlines</h2>
                  <div className="space-y-4">
                    {headlines.question.map((headline) => (
                      <HeadlineCard
                        key={headline.id}
                        headline={headline}
                        onRate={handleRate}
                        onCopy={copyToClipboard}
                        onGenerateMore={handleGenerateMore}
                        isGenerating={generateMoreMutation.isPending}
                      />
                    ))}
                  </div>
                </div>
              )}

              {headlines.authority.length > 0 && (
                <div>
                  <h2 className="text-xl font-bold mb-4">Authority Headlines</h2>
                  <div className="space-y-4">
                    {headlines.authority.map((headline) => (
                      <HeadlineCard
                        key={headline.id}
                        headline={headline}
                        onRate={handleRate}
                        onCopy={copyToClipboard}
                        onGenerateMore={handleGenerateMore}
                        isGenerating={generateMoreMutation.isPending}
                      />
                    ))}
                  </div>
                </div>
              )}

              {headlines.urgency.length > 0 && (
                <div>
                  <h2 className="text-xl font-bold mb-4">Urgency Headlines</h2>
                  <div className="space-y-4">
                    {headlines.urgency.map((headline) => (
                      <HeadlineCard
                        key={headline.id}
                        headline={headline}
                        onRate={handleRate}
                        onCopy={copyToClipboard}
                        onGenerateMore={handleGenerateMore}
                        isGenerating={generateMoreMutation.isPending}
                      />
                    ))}
                  </div>
                </div>
              )}
              </div>
            </PillTabContent>

            {/* Story Tab */}
            <PillTabContent value="story" activeTab={activeTab}>
              <div className="space-y-4">
              {headlines.story.length > 0 ? (
                headlines.story.map((headline) => (
                  <HeadlineCard
                    key={headline.id}
                    headline={headline}
                    onRate={handleRate}
                    onCopy={copyToClipboard}
                    onGenerateMore={handleGenerateMore}
                    isGenerating={generateMoreMutation.isPending}
                  />
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">No story headlines generated</p>
              )}
              </div>
            </PillTabContent>

            {/* Eyebrow Tab */}
            <PillTabContent value="eyebrow" activeTab={activeTab}>
              <div className="space-y-4">
              {headlines.eyebrow.length > 0 ? (
                headlines.eyebrow.map((headline) => (
                  <HeadlineCard
                    key={headline.id}
                    headline={headline}
                    onRate={handleRate}
                    onCopy={copyToClipboard}
                    onGenerateMore={handleGenerateMore}
                    isGenerating={generateMoreMutation.isPending}
                  />
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">No eyebrow headlines generated</p>
              )}
              </div>
            </PillTabContent>

            {/* Question Tab */}
            <PillTabContent value="question" activeTab={activeTab}>
              <div className="space-y-4">
              {headlines.question.length > 0 ? (
                headlines.question.map((headline) => (
                  <HeadlineCard
                    key={headline.id}
                    headline={headline}
                    onRate={handleRate}
                    onCopy={copyToClipboard}
                    onGenerateMore={handleGenerateMore}
                    isGenerating={generateMoreMutation.isPending}
                  />
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">No question headlines generated</p>
              )}
              </div>
            </PillTabContent>

            {/* Authority Tab */}
            <PillTabContent value="authority" activeTab={activeTab}>
              <div className="space-y-4">
              {headlines.authority.length > 0 ? (
                headlines.authority.map((headline) => (
                  <HeadlineCard
                    key={headline.id}
                    headline={headline}
                    onRate={handleRate}
                    onCopy={copyToClipboard}
                    onGenerateMore={handleGenerateMore}
                    isGenerating={generateMoreMutation.isPending}
                  />
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">No authority headlines generated</p>
              )}
              </div>
            </PillTabContent>

            {/* Urgency Tab */}
            <PillTabContent value="urgency" activeTab={activeTab}>
              <div className="space-y-4">
              {headlines.urgency.length > 0 ? (
                headlines.urgency.map((headline) => (
                  <HeadlineCard
                    key={headline.id}
                    headline={headline}
                    onRate={handleRate}
                    onCopy={copyToClipboard}
                    onGenerateMore={handleGenerateMore}
                    isGenerating={generateMoreMutation.isPending}
                  />
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">No urgency headlines generated</p>
              )}
              </div>
            </PillTabContent>

            {/* Power Mode Tab */}
            <PillTabContent value="powermode" activeTab={activeTab}>
              <Card className="p-6 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold mb-1">Advanced options</h3>
                    <p className="text-sm text-muted-foreground">Enable to generate 15 additional variations automatically</p>
                  </div>
                  <Switch 
                    checked={user?.powerMode ?? false}
                    onCheckedChange={(checked) => togglePowerMode.mutate({ enabled: checked })}
                    disabled={togglePowerMode.isPending}
                  />
                </div>
              </Card>
              <div className="text-center py-12">
                <h3 className="text-xl font-semibold mb-2">Advanced Variations</h3>
                <p className="text-muted-foreground mb-4">Additional headline variations will appear here</p>
                <Button 
                  variant="default" 
                  className="bg-purple-600 hover:bg-purple-700"
                  onClick={handleGenerateMore}
                  disabled={generateMoreMutation.isPending}
                >
                  {generateMoreMutation.isPending ? "Generating..." : "Generate Advanced Headlines"}
                </Button>
              </div>
            </PillTabContent>
        </div>
      </Card>
      </div>

      {/* Regenerate Sidebar */}
      <RegenerateSidebar
        title="Regenerate Headlines"
        subtitle="Submit or modify the pre-filled form below to regenerate a similar set of headlines"
        onRegenerate={handleRegenerate}
        isLoading={generateMoreMutation.isPending}
        creditText="Uses 1 Headline Credit"
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
              maxLength={48}
              placeholder="e.g., Struggling to generate leads"
            />
          </div>
          <div>
            <Label htmlFor="desiredOutcome">The result your customer wants*</Label>
            <Textarea
              id="desiredOutcome"
              value={regenerateForm.desiredOutcome}
              onChange={(e) => setRegenerateForm({ ...regenerateForm, desiredOutcome: e.target.value })}
              maxLength={25}
              placeholder="e.g., 10x more qualified leads"
            />
          </div>
          <div>
            <Label htmlFor="uniqueMechanism">Unique Mechanism*</Label>
            <Textarea
              id="uniqueMechanism"
              value={regenerateForm.uniqueMechanism}
              onChange={(e) => setRegenerateForm({ ...regenerateForm, uniqueMechanism: e.target.value })}
              placeholder="e.g., AI-powered lead magnet system"
            />
          </div>
        </div>
      </RegenerateSidebar>

      {/* Regenerate Confirmation Dialog */}
      <RegenerateConfirmationDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        onConfirm={confirmGenerateMore}
        generatorName="Headlines"
        currentCount={authUser?.headlineGeneratedCount || 0}
        limit={authUser?.role === "superuser" ? Infinity : (authUser?.subscriptionTier === "agency" ? 999 : authUser?.subscriptionTier === "pro" ? 6 : 0)}
        resetDate={undefined}
        isLoading={generateMoreMutation.isPending}
      />
      </div>
    </div>
  );
}
