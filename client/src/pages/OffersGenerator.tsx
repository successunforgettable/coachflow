import { useAuth } from "@/_core/hooks/useAuth";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { ArrowLeft, Copy, DollarSign, Loader2, Star, Trash2, Download } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { QuotaIndicator } from "@/components/QuotaIndicator";
import { SearchBar } from "@/components/SearchBar";
import { exportToPDF } from "@/lib/pdfExport";

export default function OffersGenerator() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [offerType, setOfferType] = useState<"standard" | "premium" | "vip">("standard");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: services } = trpc.services.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: offers, refetch } = trpc.offers.list.useQuery(undefined, { enabled: isAuthenticated });

  const generateMutation = trpc.offers.generate.useMutation({
    onSuccess: () => {
      toast.success("Offer generated!");
      refetch();
    },
    onError: (error) => toast.error(`Error: ${error.message}`),
  });

  const deleteMutation = trpc.offers.delete.useMutation({
    onSuccess: () => {
      toast.success("Offer deleted");
      refetch();
    },
  });

  const updateRatingMutation = trpc.offers.update.useMutation({
    onSuccess: () => refetch(),
  });

  const generateMoreMutation = trpc.offers.generate.useMutation({
    onSuccess: () => {
      toast.success("Generated 15 more offers!");
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to generate more: ${error.message}`);
    },
  });

  const handleGenerateMore = (offer: any) => {
    if (!offer.serviceId || !offer.offerType) {
      toast.error("Cannot regenerate: Missing service or offer type");
      return;
    }
    
    generateMoreMutation.mutate({
      serviceId: offer.serviceId,
      offerType: offer.offerType,
      price: offer.pricing || "$997",
    });
  };

  const handleDownloadPDF = (offer: any) => {
    const sections = [
      { title: "Offer Name", content: offer.offerName || 'No name' },
      { title: "Value Proposition", content: offer.valueProposition || 'No value proposition' },
      { title: "Pricing", content: offer.pricing || 'No pricing' },
      { title: "Bonuses", content: offer.bonuses || 'No bonuses' },
      { title: "Guarantee", content: offer.guarantee || 'No guarantee' },
      { title: "Urgency/Scarcity", content: offer.urgency || 'No urgency' },
      { title: "Call to Action", content: offer.cta || 'No CTA' },
    ];

    exportToPDF({
      title: "Godfather Offer",
      subtitle: `${offer.offerType?.charAt(0).toUpperCase()}${offer.offerType?.slice(1)} Offer`,
      sections,
      metadata: {
        generatedDate: new Date(offer.createdAt).toLocaleDateString(),
        generatorType: "Offers Generator",
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
        <QuotaIndicator generatorType="offer" />
      </div>
      <PageHeader 
        title="Offers Generator" 
        description="Create irresistible Godfather offers"
        backTo="/dashboard"
      />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/dashboard"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Godfather Offers Generator</h1>
            <p className="text-muted-foreground">Create irresistible offers they can't refuse</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Generate Offer</CardTitle>
                <CardDescription>Select service and offer type</CardDescription>
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
                  <label className="text-sm font-medium text-foreground mb-2 block">Offer Type</label>
                  <Select value={offerType} onValueChange={(v: any) => setOfferType(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard (Entry Level)</SelectItem>
                      <SelectItem value="premium">Premium (High Value)</SelectItem>
                      <SelectItem value="vip">VIP (Exclusive)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => serviceId && generateMutation.mutate({ serviceId, offerType, price: "997" })} disabled={generateMutation.isPending || !serviceId} className="w-full">
                  {generateMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</> : "Generate Offer"}
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            {/* Search Bar */}
            <div className="mb-6">
              <SearchBar
                placeholder="Search Offers..."
                value={searchQuery}
                onChange={setSearchQuery}
              />
            </div>

            <h2 className="text-2xl font-bold text-foreground mb-4">Your Offers ({offers?.length || 0})</h2>
            {!offers || offers.length === 0 ? (
              <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">No offers yet. Create your first one!</p></CardContent></Card>
            ) : (
              <div className="space-y-4">
                {offers
                  .filter((offer) =>
                    offer.headline?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    offer.offerType?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    offer.whatIncluded?.some((item: string) => 
                      item.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                  )
                  .map((offer) => (
                  <Card key={offer.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-5 h-5 text-green-500" />
                            <CardTitle className="text-lg">{offer.offerType?.toUpperCase()} Offer</CardTitle>
                          </div>
                          <CardDescription>{new Date(offer.createdAt).toLocaleDateString()}</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            {[1,2,3,4,5].map((star) => (
                              <button key={star} onClick={() => updateRatingMutation.mutate({ id: offer.id, rating: star })}>
                                <Star className={`w-4 h-4 ${star <= (offer.rating || 0) ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground"}`} />
                              </button>
                            ))}
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => handleDownloadPDF(offer)} title="Download PDF">
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate({ id: offer.id })}>
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
                            <Button variant="ghost" size="icon" onClick={() => navigator.clipboard.writeText(offer.headline)}>
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                          <p className="text-lg font-bold text-foreground">{offer.headline}</p>
                        </div>

                        {/* What's Included */}
                        <div className="p-4 bg-accent rounded-lg">
                          <h4 className="font-semibold text-foreground mb-3">What's Included</h4>
                          <ul className="space-y-2">
                            {(offer.whatIncluded as any)?.map((item: string, idx: number) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="text-primary mt-1">✓</span>
                                <span className="text-sm text-foreground">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Bonuses */}
                        {offer.bonuses && (offer.bonuses as any).length > 0 && (
                          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                            <h4 className="font-semibold text-foreground mb-3">Bonuses</h4>
                            <div className="space-y-2">
                              {(offer.bonuses as any)?.map((bonus: any, idx: number) => (
                                <div key={idx} className="flex items-start justify-between">
                                  <span className="text-sm text-foreground">{bonus.name}</span>
                                  <span className="text-sm font-semibold text-green-500">{bonus.value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Guarantee */}
                        {offer.guarantee && (
                          <div className="p-4 bg-primary/10 border border-primary rounded-lg">
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="font-semibold text-foreground">Guarantee</h4>
                              <Button variant="ghost" size="icon" onClick={() => navigator.clipboard.writeText(offer.guarantee!)}>
                                <Copy className="w-4 h-4" />
                              </Button>
                            </div>
                            <p className="text-sm text-foreground">{offer.guarantee}</p>
                          </div>
                        )}

                        {/* Price */}
                        {offer.price && (
                          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-center">
                            <p className="text-sm text-muted-foreground mb-1">Investment</p>
                            <p className="text-3xl font-bold text-green-500">${offer.price}</p>
                          </div>
                        )}

                        {/* +15 More Like This Button */}
                        <div className="flex justify-end pt-2">
                          <Button
                            size="sm"
                            onClick={() => handleGenerateMore(offer)}
                            disabled={generateMoreMutation.isPending}
                            className="bg-primary hover:bg-primary/90"
                          >
                            {generateMoreMutation.isPending ? "Generating..." : "+15 More Like This"}
                          </Button>
                        </div>
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
