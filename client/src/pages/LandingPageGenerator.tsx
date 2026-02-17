import { useAuth } from "@/_core/hooks/useAuth";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { FileText, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { QuotaIndicator } from "@/components/QuotaIndicator";
import { SearchBar } from "@/components/SearchBar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LandingPageGenerator() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [avatarName, setAvatarName] = useState("");
  const [avatarDescription, setAvatarDescription] = useState("");
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
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Landing Pages" backTo="/dashboard" />
      
      <div className="container max-w-7xl py-8">
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
                  <Label htmlFor="avatarName">Dream Buyer Avatar Name (Optional)</Label>
                  <Input
                    id="avatarName"
                    value={avatarName}
                    onChange={(e) => setAvatarName(e.target.value)}
                    placeholder="e.g., Amir from Abu Dhabi"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Personalizes the landing page copy
                  </p>
                </div>

                <div>
                  <Label htmlFor="avatarDescription">Avatar Description (Optional)</Label>
                  <Input
                    id="avatarDescription"
                    value={avatarDescription}
                    onChange={(e) => setAvatarDescription(e.target.value)}
                    placeholder="e.g., Expat Professional"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Adds context for better targeting
                  </p>
                </div>

                <Button
                  onClick={handleGenerate}
                  disabled={!serviceId || generateMutation.isPending}
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
                {filteredPages?.map((page) => (
                  <Card key={page.id} className="hover:shadow-lg transition-shadow">
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
                            <Button size="sm" className="bg-green-600 hover:bg-green-700">
                              View Landing Page
                            </Button>
                          </Link>
                          <Button
                            size="sm"
                            variant="destructive"
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
