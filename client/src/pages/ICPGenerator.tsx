import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { useState } from "react";
import { Loader2, Sparkles, Star, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

export default function ICPGenerator() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
  const [icpName, setIcpName] = useState("");
  const [selectedICPId, setSelectedICPId] = useState<number | null>(null);

  // Queries
  const { data: services } = trpc.services.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: icps, refetch: refetchICPs } = trpc.icps.list.useQuery(
    { serviceId: selectedServiceId || undefined },
    { enabled: isAuthenticated }
  );

  const { data: selectedICP } = trpc.icps.get.useQuery(
    { id: selectedICPId! },
    { enabled: !!selectedICPId }
  );

  // Mutations
  const generateMutation = trpc.icps.generate.useMutation({
    onSuccess: () => {
      refetchICPs();
      setIcpName("");
    },
  });

  const updateMutation = trpc.icps.update.useMutation({
    onSuccess: () => {
      refetchICPs();
    },
  });

  const deleteMutation = trpc.icps.delete.useMutation({
    onSuccess: () => {
      refetchICPs();
      setSelectedICPId(null);
    },
  });

  // Redirect to login if not authenticated
  if (!authLoading && !isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  const handleGenerate = () => {
    if (!selectedServiceId || !icpName) return;
    generateMutation.mutate({
      serviceId: selectedServiceId,
      name: icpName,
    });
  };

  const handleRating = (icpId: number, rating: number) => {
    updateMutation.mutate({ id: icpId, rating });
  };

  const handleDelete = (icpId: number) => {
    if (confirm("Are you sure you want to delete this ICP?")) {
      deleteMutation.mutate({ id: icpId });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Ideal Customer Profile Generator</h1>
          <p className="text-muted-foreground mt-1">
            AI-powered customer research with demographics, pain points, and buying triggers
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Generator Form */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Generate ICP
                </CardTitle>
                <CardDescription>Select a service and generate customer profile</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="service">Select Service *</Label>
                  <Select
                    value={selectedServiceId?.toString() || ""}
                    onValueChange={(value) => setSelectedServiceId(parseInt(value))}
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

                <div className="space-y-2">
                  <Label htmlFor="icpName">ICP Name *</Label>
                  <Input
                    id="icpName"
                    value={icpName}
                    onChange={(e) => setIcpName(e.target.value)}
                    placeholder="e.g., Tech Executive"
                  />
                </div>

                <Button
                  onClick={handleGenerate}
                  disabled={!selectedServiceId || !icpName || generateMutation.isPending}
                  className="w-full flex items-center justify-center gap-2"
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate ICP
                    </>
                  )}
                </Button>

                {generateMutation.isError && (
                  <p className="text-sm text-destructive">
                    Error: {generateMutation.error.message}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* ICP List */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Generated ICPs</CardTitle>
                <CardDescription>
                  {icps?.length || 0} profile{icps?.length !== 1 ? "s" : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {icps && icps.length > 0 ? (
                  <div className="space-y-2">
                    {icps.map((icp) => (
                      <div
                        key={icp.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedICPId === icp.id
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50"
                        }`}
                        onClick={() => setSelectedICPId(icp.id)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-medium text-foreground">{icp.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(icp.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(icp.id);
                            }}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No ICPs generated yet
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - ICP Details */}
          <div className="lg:col-span-2">
            {selectedICP ? (
              <div className="space-y-6">
                {/* Header with Rating */}
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-2xl">{selectedICP.name}</CardTitle>
                        <CardDescription>
                          Created {new Date(selectedICP.createdAt).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => handleRating(selectedICP.id, star)}
                            disabled={updateMutation.isPending}
                          >
                            <Star
                              className={`w-5 h-5 ${
                                star <= (selectedICP.rating || 0)
                                  ? "fill-primary text-primary"
                                  : "text-muted-foreground"
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  </CardHeader>
                </Card>

                {/* Demographics */}
                <Card>
                  <CardHeader>
                    <CardTitle>Demographics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      {selectedICP.demographics &&
                        typeof selectedICP.demographics === "object" &&
                        Object.entries(selectedICP.demographics).map(([key, value]) => (
                          <div key={key}>
                            <p className="text-sm font-medium text-muted-foreground capitalize">
                              {key.replace(/_/g, " ")}
                            </p>
                            <p className="text-foreground">{value as string}</p>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Pain Points */}
                <Card>
                  <CardHeader>
                    <CardTitle>Pain Points</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={selectedICP.painPoints || ""}
                      readOnly
                      rows={6}
                      className="font-mono text-sm"
                    />
                  </CardContent>
                </Card>

                {/* Desired Outcomes */}
                <Card>
                  <CardHeader>
                    <CardTitle>Desired Outcomes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={selectedICP.desiredOutcomes || ""}
                      readOnly
                      rows={6}
                      className="font-mono text-sm"
                    />
                  </CardContent>
                </Card>

                {/* Values & Motivations */}
                <Card>
                  <CardHeader>
                    <CardTitle>Values & Motivations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={selectedICP.valuesMotivations || ""}
                      readOnly
                      rows={6}
                      className="font-mono text-sm"
                    />
                  </CardContent>
                </Card>

                {/* Buying Triggers */}
                <Card>
                  <CardHeader>
                    <CardTitle>Buying Triggers</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={selectedICP.buyingTriggers || ""}
                      readOnly
                      rows={6}
                      className="font-mono text-sm"
                    />
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Sparkles className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Select an ICP from the list or generate a new one to view details
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
