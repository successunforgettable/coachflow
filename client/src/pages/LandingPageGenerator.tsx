import { useAuth } from "@/_core/hooks/useAuth";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { ArrowLeft, Copy, FileText, Loader2, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function LandingPageGenerator() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [angle, setAngle] = useState<"shock_solve" | "contrarian" | "story" | "authority">("shock_solve");

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

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
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
                </div>
                <Button onClick={() => serviceId && generateMutation.mutate({ serviceId, angle })} disabled={generateMutation.isPending || !serviceId} className="w-full">
                  {generateMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</> : "Generate Landing Page"}
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold text-foreground mb-4">Your Landing Pages ({pages?.length || 0})</h2>
            {!pages || pages.length === 0 ? (
              <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">No landing pages yet. Create your first one!</p></CardContent></Card>
            ) : (
              <div className="space-y-4">
                {pages.map((page) => (
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
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
