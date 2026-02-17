import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ArrowLeft, Download, Trash2, Copy, ThumbsUp, ThumbsDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { exportToPDF } from "@/lib/pdfExport";
import RegenerateSidebar from "@/components/RegenerateSidebar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

export default function HeadlinesDetail() {
  const [, params] = useRoute("/headlines/:id");
  const headlineSetId = params?.id || "";

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

  const generateMoreMutation = trpc.headlines.generate.useMutation({
    onSuccess: () => {
      toast.success("+15 more headlines generated!");
      refetch();
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const handleGenerateMore = () => {
    if (!data) return;
    
    // Use the stored parameters from any headline in the set
    const firstHeadline = data.headlines.story[0] || data.headlines.eyebrow[0] || data.headlines.question[0] || data.headlines.authority[0] || data.headlines.urgency[0];
    if (!firstHeadline) return;
    
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
        generatorType: "Direct Response Headlines",
      },
    });

    toast.success("PDF downloaded successfully!");
  };

  const firstHeadline = data.headlines.story[0] || data.headlines.eyebrow[0] || data.headlines.question[0] || data.headlines.authority[0] || data.headlines.urgency[0];
  
  const [regenerateForm, setRegenerateForm] = useState({
    targetMarket: firstHeadline?.targetMarket || "",
    pressingProblem: firstHeadline?.pressingProblem || "",
    desiredOutcome: firstHeadline?.desiredOutcome || "",
    uniqueMechanism: firstHeadline?.uniqueMechanism || "",
  });

  const handleRegenerate = () => {
    generateMoreMutation.mutate({
      serviceId: firstHeadline?.serviceId || undefined,
      campaignId: firstHeadline?.campaignId || undefined,
      ...regenerateForm,
    });
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
            <h3 className="font-semibold mb-2">Pressing Problem</h3>
            <p className="text-sm text-muted-foreground">{metadata.pressingProblem}</p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Desired Outcome</h3>
            <p className="text-sm text-muted-foreground">{metadata.desiredOutcome}</p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Unique Mechanism</h3>
            <p className="text-sm text-muted-foreground">{metadata.uniqueMechanism}</p>
          </div>
        </div>
      </Card>

      {/* 2-Tab Layout: Headlines + Beast Mode */}
      <Tabs defaultValue="headlines" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="headlines">Headlines</TabsTrigger>
          <TabsTrigger value="beastmode">Beast Mode</TabsTrigger>
        </TabsList>

        <TabsContent value="headlines">
          <div className="space-y-8">
        {/* Story-Based Headlines */}
        {headlines.story.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Story-Based Headlines</h2>
            <div className="space-y-4">
              {headlines.story.map((headline) => (
                <Card key={headline.id} className="p-6">
                  <p className="text-lg mb-4">{headline.headline}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <Button
                        variant={headline.rating === 1 ? "default" : "outline"}
                        size="sm"
                        onClick={() => rateMutation.mutate({ headlineId: headline.id, rating: headline.rating === 1 ? 0 : 1 })}
                      >
                        <ThumbsUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={headline.rating === -1 ? "destructive" : "outline"}
                        size="sm"
                        onClick={() => rateMutation.mutate({ headlineId: headline.id, rating: headline.rating === -1 ? 0 : -1 })}
                      >
                        <ThumbsDown className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(headline.headline)}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                        onClick={handleGenerateMore}
                        disabled={generateMoreMutation.isPending}
                      >
                        {generateMoreMutation.isPending ? "Generating..." : "+15 More Like This"}
                      </Button>
                      <Button variant="outline" size="sm">
                        <TrendingUp className="h-4 w-4 mr-2" />
                        Report CTR
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Eyebrow + Main + Subheadline */}
        {headlines.eyebrow.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Eyebrow + Main Headline + Subheadline</h2>
            <div className="space-y-4">
              {headlines.eyebrow.map((headline) => (
                <Card key={headline.id} className="p-6">
                  <div className="mb-4">
                    <p className="text-xs text-purple-600 font-semibold uppercase mb-2">{headline.eyebrow}</p>
                    <p className="text-lg font-bold mb-2">{headline.headline}</p>
                    <p className="text-sm text-muted-foreground">{headline.subheadline}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <Button
                        variant={headline.rating === 1 ? "default" : "outline"}
                        size="sm"
                        onClick={() => rateMutation.mutate({ headlineId: headline.id, rating: headline.rating === 1 ? 0 : 1 })}
                      >
                        <ThumbsUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={headline.rating === -1 ? "destructive" : "outline"}
                        size="sm"
                        onClick={() => rateMutation.mutate({ headlineId: headline.id, rating: headline.rating === -1 ? 0 : -1 })}
                      >
                        <ThumbsDown className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(`${headline.eyebrow}\n${headline.headline}\n${headline.subheadline}`)}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                        onClick={handleGenerateMore}
                        disabled={generateMoreMutation.isPending}
                      >
                        {generateMoreMutation.isPending ? "Generating..." : "+15 More Like This"}
                      </Button>
                      <Button variant="outline" size="sm">
                        <TrendingUp className="h-4 w-4 mr-2" />
                        Report CTR
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Question-Based Headlines */}
        {headlines.question.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Question-Based Headlines</h2>
            <div className="space-y-4">
              {headlines.question.map((headline) => (
                <Card key={headline.id} className="p-6">
                  <p className="text-lg mb-4">{headline.headline}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <Button
                        variant={headline.rating === 1 ? "default" : "outline"}
                        size="sm"
                        onClick={() => rateMutation.mutate({ headlineId: headline.id, rating: headline.rating === 1 ? 0 : 1 })}
                      >
                        <ThumbsUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={headline.rating === -1 ? "destructive" : "outline"}
                        size="sm"
                        onClick={() => rateMutation.mutate({ headlineId: headline.id, rating: headline.rating === -1 ? 0 : -1 })}
                      >
                        <ThumbsDown className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(headline.headline)}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                        onClick={handleGenerateMore}
                        disabled={generateMoreMutation.isPending}
                      >
                        {generateMoreMutation.isPending ? "Generating..." : "+15 More Like This"}
                      </Button>
                      <Button variant="outline" size="sm">
                        <TrendingUp className="h-4 w-4 mr-2" />
                        Report CTR
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Authority-Based Headlines */}
        {headlines.authority.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Authority-Based Headlines</h2>
            <div className="space-y-4">
              {headlines.authority.map((headline) => (
                <Card key={headline.id} className="p-6">
                  <div className="mb-4">
                    <p className="text-lg font-bold mb-2">{headline.headline}</p>
                    <p className="text-sm text-muted-foreground">{headline.subheadline}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <Button
                        variant={headline.rating === 1 ? "default" : "outline"}
                        size="sm"
                        onClick={() => rateMutation.mutate({ headlineId: headline.id, rating: headline.rating === 1 ? 0 : 1 })}
                      >
                        <ThumbsUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={headline.rating === -1 ? "destructive" : "outline"}
                        size="sm"
                        onClick={() => rateMutation.mutate({ headlineId: headline.id, rating: headline.rating === -1 ? 0 : -1 })}
                      >
                        <ThumbsDown className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(`${headline.headline}\n${headline.subheadline}`)}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                        onClick={handleGenerateMore}
                        disabled={generateMoreMutation.isPending}
                      >
                        {generateMoreMutation.isPending ? "Generating..." : "+15 More Like This"}
                      </Button>
                      <Button variant="outline" size="sm">
                        <TrendingUp className="h-4 w-4 mr-2" />
                        Report CTR
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Urgency-Based Headlines */}
        {headlines.urgency.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Urgency-Based Headlines</h2>
            <div className="space-y-4">
              {headlines.urgency.map((headline) => (
                <Card key={headline.id} className="p-6">
                  <p className="text-lg mb-4">{headline.headline}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <Button
                        variant={headline.rating === 1 ? "default" : "outline"}
                        size="sm"
                        onClick={() => rateMutation.mutate({ headlineId: headline.id, rating: headline.rating === 1 ? 0 : 1 })}
                      >
                        <ThumbsUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={headline.rating === -1 ? "destructive" : "outline"}
                        size="sm"
                        onClick={() => rateMutation.mutate({ headlineId: headline.id, rating: headline.rating === -1 ? 0 : -1 })}
                      >
                        <ThumbsDown className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(headline.headline)}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                        onClick={handleGenerateMore}
                        disabled={generateMoreMutation.isPending}
                      >
                        {generateMoreMutation.isPending ? "Generating..." : "+15 More Like This"}
                      </Button>
                      <Button variant="outline" size="sm">
                        <TrendingUp className="h-4 w-4 mr-2" />
                        Report CTR
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
          </div>
        </TabsContent>

        <TabsContent value="beastmode">
          <div className="text-center py-12">
            <h3 className="text-xl font-semibold mb-2">Beast Mode Variations</h3>
            <p className="text-muted-foreground mb-4">Additional headline variations will appear here</p>
            <Button 
              variant="default" 
              className="bg-purple-600 hover:bg-purple-700"
              onClick={handleGenerateMore}
              disabled={generateMoreMutation.isPending}
            >
              {generateMoreMutation.isPending ? "Generating..." : "Generate Beast Mode Headlines"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>

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
            <Label htmlFor="pressingProblem">Pressing Problem*</Label>
            <Textarea
              id="pressingProblem"
              value={regenerateForm.pressingProblem}
              onChange={(e) => setRegenerateForm({ ...regenerateForm, pressingProblem: e.target.value })}
              maxLength={48}
              placeholder="e.g., Struggling to generate leads"
            />
          </div>
          <div>
            <Label htmlFor="desiredOutcome">Desired Outcome*</Label>
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
      </div>
      </div>
    </div>
  );
}
