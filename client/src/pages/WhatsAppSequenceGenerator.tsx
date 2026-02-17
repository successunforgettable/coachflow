import { useAuth } from "@/_core/hooks/useAuth";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { ArrowLeft, Copy, Loader2, MessageCircle, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { QuotaIndicator } from "@/components/QuotaIndicator";
import { SearchBar } from "@/components/SearchBar";

export default function WhatsAppSequenceGenerator() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [sequenceType, setSequenceType] = useState<"engagement" | "sales">("engagement");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: services } = trpc.services.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: sequences, refetch } = trpc.whatsappSequences.list.useQuery(undefined, { enabled: isAuthenticated });

  const generateMutation = trpc.whatsappSequences.generate.useMutation({
    onSuccess: () => {
      toast.success("WhatsApp sequence generated!");
      refetch();
    },
    onError: (error) => toast.error(`Error: ${error.message}`),
  });

  const deleteMutation = trpc.whatsappSequences.delete.useMutation({
    onSuccess: () => {
      toast.success("Sequence deleted");
      refetch();
    },
  });

  const updateRatingMutation = trpc.whatsappSequences.update.useMutation({
    onSuccess: () => refetch(),
  });

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-4">
        <QuotaIndicator generatorType="whatsappSeq" />
      </div>
      <PageHeader 
        title="WhatsApp Sequence Generator" 
        description="Create engaging WhatsApp message sequences"
        backTo="/dashboard"
      />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/dashboard"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
          <div>
            <h1 className="text-3xl font-bold text-foreground">WhatsApp Sequence Generator</h1>
            <p className="text-muted-foreground">Helo.ai 7-Strategy Framework for WhatsApp marketing</p>
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
                      <SelectItem value="engagement">Engagement (Build Relationship)</SelectItem>
                      <SelectItem value="sales">Sales (Convert to Customer)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => serviceId && generateMutation.mutate({ serviceId, sequenceType, name: `${sequenceType} WhatsApp Sequence` })} disabled={generateMutation.isPending || !serviceId} className="w-full">
                  {generateMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</> : "Generate Sequence"}
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            {/* Search Bar */}
            <div className="mb-6">
              <SearchBar
                placeholder="Search WhatsApp Sequences..."
                value={searchQuery}
                onChange={setSearchQuery}
              />
            </div>

            <h2 className="text-2xl font-bold text-foreground mb-4">Your Sequences ({sequences?.length || 0})</h2>
            {!sequences || sequences.length === 0 ? (
              <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">No sequences yet. Create your first one!</p></CardContent></Card>
            ) : (
              <div className="space-y-4">
                {sequences
                  .filter((seq) =>
                    seq.sequenceType?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    seq.messages?.some(msg => 
                      msg.message?.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                  )
                  .map((seq) => (
                  <Card key={seq.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <MessageCircle className="w-5 h-5 text-green-500" />
                            <CardTitle className="text-lg">{seq.sequenceType?.toUpperCase()} Sequence</CardTitle>
                          </div>
                          <CardDescription>{new Date(seq.createdAt).toLocaleDateString()} • {seq.messages?.length || 0} messages</CardDescription>
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
                        {(seq.messages as any)?.map((message: any, idx: number) => (
                          <div key={idx} className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <MessageCircle className="w-4 h-4 text-green-500" />
                                <h4 className="font-semibold text-foreground">Message {idx + 1}</h4>
                                <span className="text-xs text-muted-foreground">({message.timing})</span>
                              </div>
                              <Button variant="ghost" size="icon" onClick={() => navigator.clipboard.writeText(message.text)}>
                                <Copy className="w-4 h-4" />
                              </Button>
                            </div>
                            <p className="text-sm text-foreground whitespace-pre-wrap">{message.text}</p>
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
