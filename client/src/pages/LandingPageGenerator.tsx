import { useAuth } from "@/_core/hooks/useAuth";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { ArrowLeft, Copy, FileText, Loader2, Star, Trash2, Download } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { QuotaIndicator } from "@/components/QuotaIndicator";
import { SearchBar } from "@/components/SearchBar";
import { exportToPDF } from "@/lib/pdfExport";
import RegenerateSidebar from "@/components/RegenerateSidebar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Real-world landing page angle examples from Kong
const LANDING_PAGE_ANGLE_EXAMPLES = {
  shock_solve: [
    "Shock: Most entrepreneurs waste 80% of their ad budget. Solve: Our AI-powered system cuts costs by 67% while doubling conversions",
    "Shock: 9 out of 10 online courses fail in the first year. Solve: Our proven launch framework guarantees $50K+ in your first 90 days",
    "Shock: Your website is losing $10K+ per month. Solve: Fix these 5 critical mistakes and watch revenue soar",
  ],
  contrarian: [
    "Why working harder is killing your business (and what to do instead)",
    "The truth about passive income that gurus won't tell you",
    "Stop chasing more traffic - here's what actually drives sales",
  ],
  story: [
    "How I went from broke and desperate to $100K/month in 6 months (and you can too)",
    "The day everything changed: My journey from corporate slave to freedom entrepreneur",
    "From $0 to 7-figures: The unconventional path nobody talks about",
  ],
  authority: [
    "Featured in Forbes, Inc, and Entrepreneur - Trusted by 10,000+ successful businesses",
    "The #1 system used by industry leaders to scale from 6 to 7 figures",
    "Developed by experts with 20+ years and $500M+ in proven results",
  ],
};

export default function LandingPageGenerator() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [angle, setAngle] = useState<"shock_solve" | "contrarian" | "story" | "authority">("shock_solve");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: services } = trpc.services.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: pages, refetch } = trpc.landingPages.list.useQuery(undefined, { enabled: isAuthenticated });

  const generateMutation = trpc.landingPages.generate.useMutation({
    onSuccess: () => {
      toast.success("Landing page generated!");
      refetch();
    },
    onError: (error) => toast.error(`Error: ${error.message}`),
  });

  const deleteMutation = trpc.landingPages.delete.useMutation({
    onSuccess: () => {
      toast.success("Landing page deleted");
      refetch();
    },
  });

  const updateRatingMutation = trpc.landingPages.update.useMutation({
    onSuccess: () => refetch(),
  });

  const generateMoreMutation = trpc.landingPages.generate.useMutation({
    onSuccess: () => {
      toast.success("Generated 15 more landing pages!");
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to generate more: ${error.message}`);
    },
  });

  const handleGenerateMore = (page: any) => {
    if (!page.serviceId || !page.angle) {
      toast.error("Cannot regenerate: Missing service or angle");
      return;
    }
    
    generateMoreMutation.mutate({
      serviceId: page.serviceId,
      angle: page.angle,
    });
  };

  const handleDownloadPDF = (page: any) => {
    const sections = [
      { title: "Headline", content: page.headline || 'No headline' },
      { title: "Subheadline", content: page.subheadline || 'No subheadline' },
      { title: "Hero Section", content: page.heroSection || 'No hero section' },
      { title: "Features", content: page.features || 'No features' },
      { title: "Benefits", content: page.benefits || 'No benefits' },
      { title: "Social Proof", content: page.socialProof || 'No social proof' },
      { title: "Call to Action", content: page.cta || 'No CTA' },
    ];

    exportToPDF({
      title: "Landing Page",
      subtitle: `${page.angle?.charAt(0).toUpperCase()}${page.angle?.slice(1).replace('_', ' ')} Angle`,
      sections,
      metadata: {
        generatedDate: new Date(page.createdAt).toLocaleDateString(),
        generatorType: "Landing Page Generator",
      },
    });

    toast.success("PDF downloaded successfully!");
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-4">
        <QuotaIndicator generatorType="landingPage" />
      </div>
      <PageHeader 
        title="Landing Page Generator" 
        description="Generate high-converting landing page copy"
        backTo="/dashboard"
      />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/dashboard"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Landing Page Generator</h1>
            <p className="text-muted-foreground">Complete landing page copy with proven angles</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Generate Landing Page</CardTitle>
                <CardDescription>Select service and angle</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Select Service</label>
                  <Select value={serviceId?.toString()} onValueChange={(v) => setServiceId(parseInt(v))}>
                    <SelectTrigger><SelectValue placeholder="Choose a service..." /></SelectTrigger>
                    <SelectContent>
                      {services?.map((s) => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Landing Page Angle</label>
                  <Select value={angle} onValueChange={(v: any) => setAngle(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="shock_solve">Shock & Solve (Problem-Solution)</SelectItem>
                      <SelectItem value="contrarian">Contrarian (Challenge Beliefs)</SelectItem>
                      <SelectItem value="story">Story (Transformation Journey)</SelectItem>
                      <SelectItem value="authority">Authority (Expert Positioning)</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {/* Examples Carousel */}
                  <div className="mt-4">
                    <p className="text-sm text-muted-foreground mb-2">Examples for {angle.replace('_', ' ')} angle:</p>
                    <div className="grid gap-2 max-h-[150px] overflow-y-auto pr-2">
                      {LANDING_PAGE_ANGLE_EXAMPLES[angle].map((example, index) => (
                        <div
                          key={index}
                          className="text-left text-xs p-2 rounded bg-muted/50 text-muted-foreground"
                        >
                          {example}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <Button onClick={() => serviceId && generateMutation.mutate({ serviceId, angle })} disabled={generateMutation.isPending || !serviceId} className="w-full">
                  {generateMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</> : "Generate Landing Page"}
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            {/* Search Bar */}
            <div className="mb-6">
              <SearchBar
                placeholder="Search Landing Pages..."
                value={searchQuery}
                onChange={setSearchQuery}
              />
            </div>

            <h2 className="text-2xl font-bold text-foreground mb-4">Your Landing Pages ({pages?.length || 0})</h2>
            {!pages || pages.length === 0 ? (
              <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">No landing pages yet. Create your first one!</p></CardContent></Card>
            ) : (
              <div className="flex gap-6">
              <div className="flex-1 space-y-4">
                {pages
                  .filter((page) =>
                    page.headline?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    page.angle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    page.sections?.some(section => 
                      section.content?.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                  )
                  .map((page) => (
                  <Card key={page.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-primary" />
                            <CardTitle className="text-lg">{page.angle ? page.angle.replace("_", " ").toUpperCase() : "Landing Page"}</CardTitle>
                          </div>
                          <CardDescription>{new Date(page.createdAt).toLocaleDateString()}</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            {[1,2,3,4,5].map((star) => (
                              <button key={star} onClick={() => updateRatingMutation.mutate({ id: page.id, rating: star })}>
                                <Star className={`w-4 h-4 ${star <= (page.rating || 0) ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground"}`} />
                              </button>
                            ))}
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => handleDownloadPDF(page)} title="Download PDF">
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate({ id: page.id })}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Headline */}
                        <div className="p-4 bg-primary/10 border border-primary rounded-lg">
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-semibold text-foreground">Headline</h4>
                            <Button variant="ghost" size="icon" onClick={() => navigator.clipboard.writeText(page.headline)}>
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                          <p className="text-lg font-bold text-foreground">{page.headline}</p>
                        </div>

                        {/* Sections */}
                        {page.sections?.map((section: any, idx: number) => (
                          <div key={idx} className="p-4 bg-accent rounded-lg">
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="font-semibold text-foreground capitalize">{section.type.replace("_", " ")}</h4>
                              <Button variant="ghost" size="icon" onClick={() => navigator.clipboard.writeText(section.content)}>
                                <Copy className="w-4 h-4" />
                              </Button>
                            </div>
                            <p className="text-sm text-foreground whitespace-pre-wrap">{section.content}</p>
                          </div>
                        ))}
                      </div>

                      {/* +15 More Like This Button */}
                      <div className="flex justify-end pt-4">
                        <Button
                          size="sm"
                          onClick={() => handleGenerateMore(page)}
                          disabled={generateMoreMutation.isPending}
                          className="bg-primary hover:bg-primary/90"
                        >
                          {generateMoreMutation.isPending ? "Generating..." : "+15 More Like This"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                 ))}
              </div>

              {/* Regenerate Sidebar */}
              <RegenerateSidebar
                title="Regenerate Landing Page"
                subtitle="Submit or modify the pre-filled form below to regenerate a similar landing page"
                onRegenerate={() => {
                  const firstPage = pages[0];
                  if (!firstPage.serviceId || !firstPage.angle) {
                    toast.error("Cannot regenerate: Missing service or angle");
                    return;
                  }
                  generateMoreMutation.mutate({
                    serviceId: firstPage.serviceId,
                    angle: firstPage.angle,
                  });
                }}
                isLoading={generateMoreMutation.isPending}
                creditText="Uses 1 Landing Page Credit"
              >
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="angle">Landing Page Angle*</Label>
                    <Select value={pages[0]?.angle || "shock_solve"} disabled>
                      <SelectTrigger id="angle">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="shock_solve">Shock & Solve</SelectItem>
                        <SelectItem value="contrarian">Contrarian</SelectItem>
                        <SelectItem value="story">Story</SelectItem>
                        <SelectItem value="authority">Authority</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </RegenerateSidebar>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
