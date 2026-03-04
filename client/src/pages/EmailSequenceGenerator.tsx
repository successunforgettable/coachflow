import { useAuth } from "@/_core/hooks/useAuth";
import PageHeader from "@/components/PageHeader";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { ArrowLeft, Copy, Loader2, Star, Trash2, Download } from "lucide-react";
import { SkeletonCardList } from "@/components/SkeletonCard";
import { useState } from "react";
import { QuotaProgressBar } from "@/components/QuotaProgressBar";
import { Link } from "wouter";
import { toast } from "sonner";
import { QuotaIndicator } from "@/components/QuotaIndicator";
import { SearchBar } from "@/components/SearchBar";
import { exportToPDF } from "@/lib/pdfExport";
import RegenerateSidebar from "@/components/RegenerateSidebar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RegenerateConfirmationDialog } from "@/components/RegenerateConfirmationDialog";
import { ComplianceBadge } from "@/components/ComplianceBadge";
import { checkCompliance } from "@/lib/complianceUtils";

// Real-world email sequence examples 
const EMAIL_SEQUENCE_EXAMPLES = {
  welcome: [
    "5-Day Welcome Sequence: Introduce your brand story, share quick wins, build trust, showcase transformation, and invite to next step",
    "7-Day Onboarding Sequence: Welcome email, set expectations, share resources, highlight key features, success stories, FAQ, and activation CTA",
    "3-Day Quick Start: Immediate value delivery, case study, and irresistible offer",
  ],
  engagement: [
    "7-Day Nurture Sequence: Educational content, industry insights, success stories, problem-solving tips, community building, value stacking, soft CTA",
    "5-Day Re-engagement: Acknowledge absence, share what's new, exclusive content, special offer, last chance",
    "Weekly Newsletter Series: Consistent value delivery with tips, case studies, and community highlights",
  ],
  sales: [
    "5-Day Sales Sequence: Problem agitation, solution introduction, social proof, objection handling, scarcity close",
    "7-Day Launch Sequence: Pre-launch hype, early bird offer, social proof, FAQ, countdown, last chance, post-launch",
    "3-Day Flash Sale: Announce offer, showcase benefits and urgency, final countdown",
  ],
};

export default function EmailSequenceGenerator() {
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const { data: quotaLimits } = trpc.auth.getQuotaLimits.useQuery();
  const { data: authData } = trpc.auth.me.useQuery();
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [sequenceType, setSequenceType] = useState<"welcome" | "engagement" | "sales">("welcome");
  const [searchQuery, setSearchQuery] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingSequence, setPendingSequence] = useState<any>(null);

  const { data: services } = trpc.services.list.useQuery(undefined, { enabled: isAuthenticated });

  // AutoPop: Pre-fill fields when service is selected
  const handleServiceChange = (value: string) => {
    const id = parseInt(value, 10);
    setServiceId(id);
    
    // Email sequences don't have many auto-fillable fields from service
    // The service data is used in the backend generator prompts
  };
  const { data: sequences, refetch } = trpc.emailSequences.list.useQuery(undefined, { enabled: isAuthenticated });

  const generateMutation = trpc.emailSequences.generate.useMutation({
    onSuccess: () => {
      toast.success("Email sequence generated!");
      refetch();
    },
    onError: (error) => toast.error(`Error: ${error.message}`),
  });

  const deleteMutation = trpc.emailSequences.delete.useMutation({
    onSuccess: () => {
      toast.success("Sequence deleted");
      refetch();
    },
  });

  const updateRatingMutation = trpc.emailSequences.update.useMutation({
    onSuccess: () => refetch(),
  });

  const generateMoreMutation = trpc.emailSequences.generate.useMutation({
    onSuccess: () => {
      toast.success("Generated 15 more email sequences!");
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to generate more: ${error.message}`);
    },
  });

  const handleGenerateMore = (sequence: any) => {
    setPendingSequence(sequence);
    setShowConfirmDialog(true);
  };

  const confirmGenerateMore = () => {
    if (!pendingSequence || !pendingSequence.serviceId || !pendingSequence.sequenceType) {
      toast.error("Cannot regenerate: Missing service or sequence type");
      return;
    }
    
    setShowConfirmDialog(false);
    const timestamp = new Date().toLocaleTimeString();
    generateMoreMutation.mutate({
      serviceId: pendingSequence.serviceId,
      sequenceType: pendingSequence.sequenceType,
      name: `${pendingSequence.sequenceType} Sequence - Variation ${timestamp}`,
    });
  };

  const handleDownloadPDF = (sequence: any) => {
    const emails = JSON.parse(sequence.emails || '[]');
    const sections = emails.map((email: any, index: number) => ({
      title: `Email ${index + 1}: ${email.subject || 'No Subject'}`,
      content: email.body || 'No content',
    }));

    exportToPDF({
      title: "Email Sequence",
      subtitle: `${sequence.sequenceType?.charAt(0).toUpperCase()}${sequence.sequenceType?.slice(1)} Sequence`,
      sections,
      metadata: {
        generatedDate: new Date(sequence.createdAt).toLocaleDateString(),
        generatorType: "Your Email Follow-Up",
      },
    });

    toast.success("PDF downloaded successfully!");
  };

  if (authLoading) {
    return (
      <div className="container max-w-7xl py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <div className="h-[400px] bg-card rounded-lg animate-pulse" />
          </div>
          <div className="lg:col-span-2">
            <SkeletonCardList count={3} />
          </div>
        </div>
      </div>
    );
  }
  if (!isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  // Check if user has reached quota limit
  const isQuotaExceeded = !!(authData && quotaLimits && authData.emailSeqGeneratedCount >= quotaLimits.email);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-4">
        {authData && (
          <QuotaProgressBar
            used={authData.emailSeqGeneratedCount}
            limit={quotaLimits?.email || 50}
            label="Email Sequences Quota"
            resetDate={authData.usageResetAt ? new Date(authData.usageResetAt) : undefined}
          />
        )}
        {authData && authData.subscriptionTier && quotaLimits && authData.emailSeqGeneratedCount >= quotaLimits.email && (
          <div className="mt-4">
            <UpgradePrompt
              generatorName="Email Sequences"
              currentTier={authData.subscriptionTier}
              used={authData.emailSeqGeneratedCount}
              limit={quotaLimits.email}
            />
          </div>
        )}
        <QuotaIndicator generatorType="emailSeq" />
      </div>
      <PageHeader 
        title="Your Email Follow-Up" 
        description="Generate automated email sequences with proven frameworks"
        backTo="/dashboard"
      />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/dashboard"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Your Email Follow-Up</h1>
            <p className="text-muted-foreground">Russell Brunson's Soap Opera Sequence framework</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Generate Sequence</CardTitle>
                <CardDescription>Select service and sequence type</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Select Service</label>
                  <Select value={serviceId?.toString()} onValueChange={handleServiceChange}>
                    <SelectTrigger><SelectValue placeholder="Choose a service..." /></SelectTrigger>
                    <SelectContent>
                      {services?.map((s) => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Sequence Type</label>
                  <Select value={sequenceType} onValueChange={(v: any) => setSequenceType(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="welcome">Welcome (Onboarding)</SelectItem>
                      <SelectItem value="engagement">Engagement (Nurture)</SelectItem>
                      <SelectItem value="sales">Sales (Conversion)</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {/* Examples Carousel */}
                  <div className="mt-4">
                    <p className="text-sm text-muted-foreground mb-2">Examples for {sequenceType} sequences:</p>
                    <div className="grid gap-2 max-h-[150px] overflow-y-auto pr-2">
                      {EMAIL_SEQUENCE_EXAMPLES[sequenceType].map((example, index) => (
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
                <Button onClick={() => serviceId && generateMutation.mutate({ serviceId, sequenceType, name: `${sequenceType} Sequence` })} disabled={generateMutation.isPending || !serviceId || isQuotaExceeded} className="w-full bg-green-600 hover:bg-green-700">
                  {generateMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</> : "Generate Sequence"}
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            {/* Search Bar */}
            <div className="mb-6">
              <SearchBar
                placeholder="Search Email Sequences..."
                value={searchQuery}
                onChange={setSearchQuery}
              />
            </div>

            <h2 className="text-2xl font-bold text-foreground mb-4">Your Sequences ({sequences?.length || 0})</h2>
            {!sequences || sequences.length === 0 ? (
              <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">No sequences yet. Create your first one!</p></CardContent></Card>
            ) : (
              <div className="flex gap-6">
              <div className="flex-1 space-y-4">
                {sequences
                  .filter((seq) =>
                    seq.sequenceType?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    seq.emails?.some(email => 
                      email.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      email.body?.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                  )
                  .map((seq, index) => (
                  <Card 
                    key={seq.id}
                    className="hover-lift transition-smooth animate-fade-in-up"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{seq.sequenceType?.toUpperCase()} Sequence</CardTitle>
                          <CardDescription>{new Date(seq.createdAt).toLocaleDateString()} • {seq.emails?.length || 0} emails</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            {[1,2,3,4,5].map((star) => (
                              <button key={star} onClick={() => updateRatingMutation.mutate({ id: seq.id, rating: star })}>
                                <Star className={`w-4 h-4 ${star <= (seq.rating || 0) ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground"}`} />
                              </button>
                            ))}
                          </div>
                          <Button variant="ghost" size="icon" className="active-press" onClick={() => handleDownloadPDF(seq)} title="Download PDF">
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="active-press" onClick={() => deleteMutation.mutate({ id: seq.id })}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {(seq.emails as any)?.map((email: any, idx: number) => {
                          const c = checkCompliance(email.subject + " " + email.body);
                          return (
                          <>
                          <div key={idx} className="p-4 bg-accent rounded-lg">
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="font-semibold text-foreground">Email {idx + 1}: {email.subject}</h4>
                              <Button variant="ghost" size="icon" onClick={() => navigator.clipboard.writeText(`Subject: ${email.subject}\n\n${email.body}`)}>
                                <Copy className="w-4 h-4" />
                              </Button>
                            </div>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{email.body}</p>
                          </div>
                          <ComplianceBadge score={c.score} compliant={c.compliant} issues={c.issues} suggestions={c.suggestions} />
                          </>
                          );
                        })}
                      </div>

                      {/* +15 More Like This Button */}
                      <div className="flex justify-end pt-4">
                        <Button
                          size="sm"
                          onClick={() => handleGenerateMore(seq)}
                          disabled={generateMoreMutation.isPending}
                          className="bg-green-600 hover:bg-green-700"
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
                title="Regenerate Email Sequence"
                subtitle="Submit or modify the pre-filled form below to regenerate a similar email sequence"
                onRegenerate={() => {
                  const firstSeq = sequences[0];
                  if (!firstSeq.serviceId || !firstSeq.sequenceType) {
                    toast.error("Cannot regenerate: Missing service or sequence type");
                    return;
                  }
                  const timestamp = new Date().toLocaleTimeString();
                  generateMoreMutation.mutate({
                    serviceId: firstSeq.serviceId,
                    sequenceType: firstSeq.sequenceType,
                    name: `${firstSeq.sequenceType} Sequence - Variation ${timestamp}`,
                  });
                }}
                isLoading={generateMoreMutation.isPending}
                creditText="Uses 1 Email Sequence Credit"
              >
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="sequenceType">Sequence Type*</Label>
                    <Select value={sequences[0]?.sequenceType || "welcome"} disabled>
                      <SelectTrigger id="sequenceType">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="welcome">Welcome</SelectItem>
                        <SelectItem value="engagement">Engagement</SelectItem>
                        <SelectItem value="sales">Sales</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="sequenceName">Sequence Name*</Label>
                    <Input
                      id="sequenceName"
                      value={sequences[0]?.name || ""}
                      readOnly
                      placeholder="e.g., 5-Day Welcome Sequence"
                    />
                  </div>
                </div>
              </RegenerateSidebar>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Regenerate Confirmation Dialog */}
      <RegenerateConfirmationDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        onConfirm={confirmGenerateMore}
        generatorName="Email Sequence"
        currentCount={user?.emailSeqGeneratedCount || 0}
        limit={user?.role === "superuser" ? Infinity : (user?.subscriptionTier === "agency" ? 999 : user?.subscriptionTier === "pro" ? 20 : 0)}
        resetDate={undefined}
        isLoading={generateMoreMutation.isPending}
      />
    </div>
  );
}
