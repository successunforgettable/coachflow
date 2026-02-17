import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, ArrowLeft, Download, Trash2, Copy, ThumbsUp, ThumbsDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { exportToPDF } from "@/lib/pdfExport";

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

  return (
    <div className="container max-w-7xl py-8">
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

      {/* Headlines by Formula Type */}
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
    </div>
  );
}
