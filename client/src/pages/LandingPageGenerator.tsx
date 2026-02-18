import { useAuth } from "@/_core/hooks/useAuth";
import PageHeader from "@/components/PageHeader";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { FileText, Loader2, Trash2 } from "lucide-react";
import { SkeletonCardList } from "@/components/SkeletonCard";
import { useState } from "react";
import { QuotaProgressBar } from "@/components/QuotaProgressBar";
import { Link } from "wouter";
import { toast } from "sonner";
import { QuotaIndicator } from "@/components/QuotaIndicator";
import { SearchBar } from "@/components/SearchBar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LandingPageGenerator() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { data: quotaLimits } = trpc.auth.getQuotaLimits.useQuery();
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [avatarName, setAvatarName] = useState("");
  const [avatarDescription, setAvatarDescription] = useState("");
  
  const avatarNameCharsLeft = 50 - avatarName.length;
  const avatarDescriptionCharsLeft = 100 - avatarDescription.length;
  const [searchQuery, setSearchQuery] = useState("");

  const { data: services } = trpc.services.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: pages, refetch } = trpc.landingPages.list.useQuery(undefined, { enabled: isAuthenticated });

  const generateMutation = trpc.landingPages.generate.useMutation({
    onSuccess: () => {
      toast.success("Landing page generated with all 4 angles!");
      refetch();
      setServiceId(null);
      setAvatarName("");
      setAvatarDescription("");
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const deleteMutation = trpc.landingPages.delete.useMutation({
    onSuccess: () => {
      toast.success("Landing page deleted");
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
      avatarName: avatarName || undefined,
      avatarDescription: avatarDescription || undefined,
    });
  };

  const filteredPages = pages?.filter((page) =>
    page.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    page.avatarName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (authLoading) {
    return (
      <div className="container max-w-7xl py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <div className="h-[500px] bg-card rounded-lg animate-pulse" />
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
        <h1 className="text-4xl font-bold mb-4">Landing Pages Generator</h1>
        <p className="text-muted-foreground mb-8">
          Generate high-converting landing pages with 16 sections and 4 angle variations
        </p>
        <Button asChild size="lg">
          <a href={getLoginUrl()}>Login to Get Started</a>
        </Button>
      </div>
    );
  }

  const { data: authData } = trpc.auth.me.useQuery();

  // Check if user has reached quota limit
  const isQuotaExceeded = !!(authData && quotaLimits && authData.landingPageGeneratedCount >= quotaLimits.landingPages);

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Landing Pages" backTo="/dashboard" />
      
      <div className="container max-w-7xl py-8">
        {authData && (
          <div className="mb-6">
            <QuotaProgressBar
              used={authData.landingPageGeneratedCount}
              limit={quotaLimits?.landingPages || 50}
              label="Landing Pages Quota"
              resetDate={authData.usageResetAt ? new Date(authData.usageResetAt) : undefined}
            />
          </div>
        )}
        {authData && authData.subscriptionTier && quotaLimits && authData.landingPageGeneratedCount >= quotaLimits.landingPages && (
          <div className="mb-6">
            <UpgradePrompt
              generatorName="Landing Pages"
              currentTier={authData.subscriptionTier}
              used={authData.landingPageGeneratedCount}
              limit={quotaLimits.landingPages}
            />
          </div>
        )}
        <QuotaIndicator generatorType="landingPage" />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
          {/* Generator Form */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Generate Landing Page</CardTitle>
                <CardDescription>
                  Create a complete landing page with all 4 angle variations (Original, Godfather, Free, Dollar)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="service">Select Service*</Label>
                  <Select
                    value={serviceId?.toString() || ""}
                    onValueChange={(value) => setServiceId(Number(value))}
                  >
                    <SelectTrigger id="service">
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
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="avatarName">Dream Buyer Avatar Name (Optional)</Label>
                    <span className={`text-xs ${avatarNameCharsLeft < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                      {avatarNameCharsLeft} chars left
                    </span>
                  </div>
                  <Input
                    id="avatarName"
                    value={avatarName}
                    onChange={(e) => setAvatarName(e.target.value)}
                    placeholder="e.g., Amir from Abu Dhabi"
                    maxLength={50}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Personalizes the landing page copy
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="avatarDescription">Avatar Description (Optional)</Label>
                    <span className={`text-xs ${avatarDescriptionCharsLeft < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                      {avatarDescriptionCharsLeft} chars left
                    </span>
                  </div>
                  <Input
                    id="avatarDescription"
                    value={avatarDescription}
                    onChange={(e) => setAvatarDescription(e.target.value)}
                    placeholder="e.g., Expat Professional"
                    maxLength={100}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Adds context for better targeting
                  </p>
                </div>

                <Button
                  onClick={handleGenerate}
                  disabled={!serviceId || generateMutation.isPending || isQuotaExceeded}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating All 4 Angles...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Generate Landing Page
                    </>
                  )}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  Generates 16 sections × 4 angles = complete landing page system
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Landing Pages List */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Your Landing Pages</h2>
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search landing pages..."
              />
            </div>

            {!pages || pages.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No landing pages yet</h3>
                  <p className="text-muted-foreground">
                    Generate your first landing page to get started
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredPages?.map((page, index) => (
                  <Card 
                    key={page.id} 
                    className="hover-lift transition-smooth animate-fade-in-up"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-xl mb-2">
                            {page.productName}
                          </CardTitle>
                          <CardDescription>
                            {page.avatarName && (
                              <span className="block mb-1">
                                <strong>Avatar:</strong> {page.avatarName}
                                {page.avatarDescription && ` - ${page.avatarDescription}`}
                              </span>
                            )}
                            <span className="block text-xs">
                              Created {new Date(page.createdAt).toLocaleDateString()}
                            </span>
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Link href={`/landing-pages/${page.id}`}>
                            <Button size="sm" className="bg-green-600 hover:bg-green-700 active-press">
                              View Landing Page
                            </Button>
                          </Link>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="active-press"
                            onClick={() => {
                              if (confirm("Delete this landing page?")) {
                                deleteMutation.mutate({ id: page.id });
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-semibold">Active Angle:</span>
                        <span className="px-3 py-1 bg-purple-600 text-white rounded-full text-xs font-semibold uppercase">
                          {page.activeAngle}
                        </span>
                        <span className="text-muted-foreground ml-2">
                          (All 4 angles available)
                        </span>
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
