import { useRoute, useLocation } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ArrowLeft, Plus, Check, Edit2, Trash2 } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

export default function CampaignICPSelection() {
  const [, params] = useRoute("/campaigns/:campaignId/icp");
  const [, setLocation] = useLocation();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedICP, setSelectedICP] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
  });

  const campaignId = params?.campaignId ? parseInt(params.campaignId) : 0;
  const { user } = useAuth();

  // Fetch campaign details
  const { data: campaign, isLoading: campaignLoading } = trpc.campaigns.getById.useQuery(
    { id: campaignId },
    { enabled: !!campaignId }
  );

  // Fetch all ICPs for user
  const { data: icps, isLoading: icpsLoading } = trpc.icps.list.useQuery();

  // Mutation to update campaign ICP
  const updateCampaignICPMutation = trpc.campaigns.updateIcp.useMutation({
    onSuccess: () => {
      toast.success("Campaign ICP updated successfully");
      setLocation(`/campaigns/${campaignId}`);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update campaign ICP");
    },
  });

  // Mutation to create new ICP
  const createICPMutation = trpc.icps.generate.useMutation({
    onSuccess: (newICP: any) => {
      toast.success("New ICP created successfully");
      setShowCreateDialog(false);
      setFormData({ name: "" });
      handleSelectICP(newICP);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create ICP");
    },
  });

  // Mutation to delete ICP
  const deleteICPMutation = trpc.icps.delete.useMutation({
    onSuccess: () => {
      toast.success("ICP deleted successfully");
      setSelectedICP(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete ICP");
    },
  });

  const handleSelectICP = (icp: any) => {
    setSelectedICP(icp);
    updateCampaignICPMutation.mutate({
      campaignId,
      icpId: icp.id,
    });
  };

  const handleCreateICP = async () => {
    if (!formData.name.trim()) {
      toast.error("Customer name is required");
      return;
    }

    createICPMutation.mutate({
      serviceId: campaign?.serviceId || 0,
      name: formData.name,
      campaignId: campaignId,
    });
  };

  const handleDeleteICP = (icpId: number) => {
    if (confirm("Are you sure you want to delete this ICP?")) {
      deleteICPMutation.mutate({ id: icpId });
    }
  };

  if (campaignLoading || icpsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => setLocation(`/campaigns/${campaignId}`)}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Campaign
          </Button>
          <h1 className="text-3xl font-bold mb-2">Select Your Ideal Customer</h1>
          <p className="text-muted-foreground">
            Choose or create an Ideal Customer Profile (ICP) for {campaign?.name}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Current Selection */}
          <div className="lg:col-span-1">
            <Card className="p-6 sticky top-6">
              <h2 className="text-lg font-semibold mb-4">Current Selection</h2>
              {campaign?.icpId ? (
                <div className="space-y-4">
                  <div className="p-4 bg-accent rounded-lg">
                    <p className="font-semibold">{selectedICP?.name || "Loading..."}</p>
                    <p className="text-sm text-muted-foreground">{selectedICP?.introduction}</p>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowEditDialog(true)}
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit This ICP
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm mb-4">No ICP selected yet</p>
              )}
            </Card>
          </div>

          {/* ICP List */}
          <div className="lg:col-span-2">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold">Available ICPs</h2>
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Create New ICP
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create New Ideal Customer Profile</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name">Ideal Customer Name</Label>
                      <Input
                        id="name"
                        placeholder="e.g., Sarah, The Ambitious Coach"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                      />
                    </div>
                    <Button
                      onClick={handleCreateICP}
                      disabled={createICPMutation.isPending}
                      className="w-full"
                    >
                      {createICPMutation.isPending ? "Creating..." : "Create ICP"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {icps && icps.length > 0 ? (
              <div className="grid gap-4">
                {icps.map((icp) => (
                  <Card
                    key={icp.id}
                    className={`p-6 cursor-pointer transition-all ${
                      campaign?.icpId === icp.id
                        ? "border-primary bg-primary/5"
                        : "hover:border-primary/50"
                    }`}
                    onClick={() => handleSelectICP(icp)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg">{icp.name}</h3>
                          {campaign?.icpId === icp.id && (
                            <Check className="w-5 h-5 text-primary" />
                          )}
                        </div>
                        {icp.introduction && (
                          <p className="text-sm text-muted-foreground mb-2">{icp.introduction}</p>
                        )}
                        {icp.fears && (
                          <div className="mb-2">
                            <p className="text-xs font-semibold text-muted-foreground">Fears:</p>
                            <p className="text-sm">{icp.fears}</p>
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteICP(icp.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground mb-4">No ICPs created yet</p>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First ICP
                </Button>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
