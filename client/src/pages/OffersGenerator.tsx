import { useAuth } from "@/_core/hooks/useAuth";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { Loader2, Trash2, FileText } from "lucide-react";
import { SkeletonCardList } from "@/components/SkeletonCard";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { QuotaIndicator } from "@/components/QuotaIndicator";
import { SearchBar } from "@/components/SearchBar";

// Real-world offer type examples from Kong
const OFFER_TYPE_EXAMPLES = {
  standard: [
    "Core Program: Complete system with step-by-step training, templates, and 30-day support - $997",
    "Starter Package: Essential tools and resources to get quick wins in 30 days - $497",
    "Foundation Course: Self-paced learning with lifetime access and community support - $697",
  ],
  premium: [
    "VIP Coaching: Core program + 6 months 1-on-1 coaching + implementation support - $4,997",
    "Accelerator Package: Everything in Standard + weekly group calls + done-for-you templates - $2,997",
    "Pro Bundle: Complete training + advanced strategies + priority support + exclusive bonuses - $1,997",
  ],
  vip: [
    "Platinum Mastermind: Everything + 12 months private coaching + in-person retreat + unlimited access - $25,000",
    "Done-For-You Service: We implement everything for you + ongoing optimization + guaranteed results - $50,000",
    "Elite Partnership: Full implementation + dedicated team + revenue share model - Custom pricing",
  ],
};

export default function OffersGenerator() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [offerType, setOfferType] = useState<"standard" | "premium" | "vip">("standard");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: services } = trpc.services.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: offers, refetch } = trpc.offers.list.useQuery(undefined, { enabled: isAuthenticated });

  const generateMutation = trpc.offers.generate.useMutation({
    onSuccess: () => {
      toast.success("Offer generated with all 3 angles!");
      refetch();
      setServiceId(null);
    },
    onError: (error) => toast.error(`Error: ${error.message}`),
  });

  const deleteMutation = trpc.offers.delete.useMutation({
    onSuccess: () => {
      toast.success("Offer deleted");
      refetch();
    },
  });

  const handleGenerate = () => {
    if (!serviceId) {
      toast.error("Please select a service");
      return;
    }

    generateMutation.mutate({
      serviceId,
      offerType,
    });
  };

  const filteredOffers = offers?.filter((offer) =>
    offer.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    offer.offerType?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (authLoading) {
    return (
      <div className="container max-w-7xl py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <div className="h-[600px] bg-card rounded-lg animate-pulse" />
          </div>
          <div className="lg:col-span-2">
            <SkeletonCardList count={3} />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="container max-w-2xl py-16 text-center">
        <h1 className="text-4xl font-bold mb-4">Godfather Offers Generator</h1>
        <p className="text-muted-foreground mb-8">
          Generate irresistible offers with 3 angle variations (Godfather, Free, Dollar)
        </p>
        <Button asChild size="lg">
          <a href={getLoginUrl()}>Login to Get Started</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Godfather Offers" backTo="/dashboard" />
      
      <div className="container max-w-7xl py-8">
        <QuotaIndicator generatorType="offer" />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
          {/* Generator Form */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Generate Offer</CardTitle>
                <CardDescription>
                  Create an irresistible offer with 3 angle variations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Select Service*</label>
                  <Select
                    value={serviceId?.toString() || ""}
                    onValueChange={(value) => setServiceId(Number(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a service..." />
                    </SelectTrigger>
                    <SelectContent>
                      {services?.map((service) => (
                        <SelectItem key={service.id} value={service.id.toString()}>
                          {service.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Offer Type*</label>
                  <Select value={offerType} onValueChange={(v: any) => setOfferType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard (Entry Level)</SelectItem>
                      <SelectItem value="premium">Premium (High Value)</SelectItem>
                      <SelectItem value="vip">VIP (Exclusive)</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {/* Examples */}
                  <div className="mt-4">
                    <p className="text-sm text-muted-foreground mb-2">Examples for {offerType} offers:</p>
                    <div className="grid gap-2 max-h-[150px] overflow-y-auto pr-2">
                      {OFFER_TYPE_EXAMPLES[offerType].map((example, index) => (
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

                <Button
                  onClick={handleGenerate}
                  disabled={!serviceId || generateMutation.isPending}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating All 3 Angles...
                    </>
                  ) : (
                    "Generate Offer"
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Offers List */}
          <div className="lg:col-span-2">
            <div className="mb-6">
              <SearchBar
                placeholder="Search Offers..."
                value={searchQuery}
                onChange={setSearchQuery}
              />
            </div>

            <h2 className="text-2xl font-bold mb-4">Your Offers ({offers?.length || 0})</h2>

            {!filteredOffers || filteredOffers.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">
                    {searchQuery ? "No offers match your search." : "No offers yet. Create your first one!"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredOffers.map((offer) => (
                  <Card key={offer.id} className="hover:border-purple-500/50 transition-colors">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <CardTitle className="text-lg">{offer.productName}</CardTitle>
                            <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded text-xs font-medium">
                              {offer.activeAngle?.toUpperCase()}
                            </span>
                          </div>
                          <CardDescription>
                            {offer.offerType?.toUpperCase()} • {new Date(offer.createdAt).toLocaleDateString()}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link href={`/offers/${offer.id}`}>
                            <Button variant="default" size="sm" className="bg-purple-600 hover:bg-purple-700">
                              <FileText className="w-4 h-4 mr-2" />
                              View Offer
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate({ id: offer.id })}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
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
