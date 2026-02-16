import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { ArrowLeft, Copy, Loader2, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function EmailSequenceGenerator() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [sequenceType, setSequenceType] = useState<"welcome" | "engagement" | "sales">("welcome");

  const { data: services } = trpc.services.list.useQuery(undefined, { enabled: isAuthenticated });
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

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/dashboard"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Email Sequence Generator</h1>
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
                  <Select value={serviceId?.toString()} onValueChange={(v) => setServiceId(parseInt(v))}>
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
                </div>
                <Button onClick={() => serviceId && generateMutation.mutate({ serviceId, sequenceType, name: `${sequenceType} Sequence` })} disabled={generateMutation.isPending || !serviceId} className="w-full">
                  {generateMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</> : "Generate Sequence"}
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold text-foreground mb-4">Your Sequences ({sequences?.length || 0})</h2>
            {!sequences || sequences.length === 0 ? (
              <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">No sequences yet. Create your first one!</p></CardContent></Card>
            ) : (
              <div className="space-y-4">
                {sequences.map((seq) => (
                  <Card key={seq.id}>
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
                          <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate({ id: seq.id })}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {(seq.emails as any)?.map((email: any, idx: number) => (
                          <div key={idx} className="p-4 bg-accent rounded-lg">
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="font-semibold text-foreground">Email {idx + 1}: {email.subject}</h4>
                              <Button variant="ghost" size="icon" onClick={() => navigator.clipboard.writeText(`Subject: ${email.subject}\n\n${email.body}`)}>
                                <Copy className="w-4 h-4" />
                              </Button>
                            </div>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{email.body}</p>
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
