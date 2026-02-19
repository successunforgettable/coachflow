import { useState, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Plus, Save, Trash2, GripVertical, Eye, Link as LinkIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AssetLibrary } from "@/components/AssetLibrary";
import { WorkflowCanvas } from "@/components/WorkflowCanvas";

interface CampaignAsset {
  id: number;
  assetId: string;
  assetType: string;
  position: number;
  title?: string;
}

interface SortableAssetCardProps {
  asset: CampaignAsset;
  onRemove: (id: number) => void;
}

function SortableAssetCard({ asset, onRemove }: SortableAssetCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: asset.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getAssetTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      headline: "bg-blue-500",
      hvco: "bg-purple-500",
      hero_mechanism: "bg-pink-500",
      icp: "bg-green-500",
      ad_copy: "bg-yellow-500",
      email: "bg-red-500",
      whatsapp: "bg-teal-500",
      landing_page: "bg-indigo-500",
      offer: "bg-orange-500",
    };
    return colors[type] || "bg-gray-500";
  };

  return (
    <div ref={setNodeRef} style={style} className="mb-3">
      <Card className="bg-card hover:bg-accent/50 transition-colors">
        <CardContent className="p-4 flex items-center gap-3">
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
            <GripVertical className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className={`w-2 h-12 rounded ${getAssetTypeColor(asset.assetType)}`} />
          <div className="flex-1">
            <div className="font-medium">{asset.title || `Asset #${asset.assetId}`}</div>
            <div className="text-sm text-muted-foreground capitalize">{asset.assetType.replace("_", " ")}</div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemove(asset.id)}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function CampaignBuilder() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [campaignName, setCampaignName] = useState("");
  const [campaignDescription, setCampaignDescription] = useState("");
  const [assets, setAssets] = useState<CampaignAsset[]>([]);
  const [isAssetLibraryOpen, setIsAssetLibraryOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"timeline" | "workflow">("timeline");

  const campaignId = id ? parseInt(id) : null;

  const { data: campaign, isLoading } = trpc.campaigns.getById.useQuery(
    { id: campaignId! },
    { enabled: !!campaignId }
  );

  const { data: campaignAssets } = trpc.campaigns.listAssets.useQuery(
    { campaignId: campaignId! },
    { enabled: !!campaignId }
  );

  const updateCampaign = trpc.campaigns.update.useMutation({
    onSuccess: () => {
      toast({ title: "Campaign saved successfully" });
    },
    onError: (error) => {
      toast({ title: "Failed to save campaign", description: error.message, variant: "destructive" });
    },
  });

  const addAssetMutation = trpc.campaigns.addAsset.useMutation({
    onSuccess: () => {
      toast({ title: "Asset added to campaign" });
    },
  });

  const removeAssetMutation = trpc.campaigns.removeAsset.useMutation({
    onSuccess: () => {
      toast({ title: "Asset removed from campaign" });
    },
  });

  const reorderAssetsMutation = trpc.campaigns.reorderAssets.useMutation();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (campaign) {
      setCampaignName(campaign.name);
      setCampaignDescription(campaign.description || "");
    }
  }, [campaign]);

  useEffect(() => {
    if (campaignAssets) {
      setAssets(campaignAssets as CampaignAsset[]);
    }
  }, [campaignAssets]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setAssets((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);

        // Update positions in database
        if (campaignId) {
          reorderAssetsMutation.mutate({
            updates: newItems.map((item, index) => ({
              assetId: item.id,
              position: index,
            })),
          });
        }

        return newItems;
      });
    }
  };

  const handleSave = () => {
    if (!campaignId) return;

    updateCampaign.mutate({
      id: campaignId,
      name: campaignName,
      description: campaignDescription,
    });
  };

  const handleAddAsset = (assetId: string, assetType: string) => {
    if (!campaignId) return;

    addAssetMutation.mutate(
      {
        campaignId,
        assetId,
        assetType: assetType as any,
        position: assets.length,
      },
      {
        onSuccess: () => {
          // Refetch assets after adding
          window.location.reload();
        },
      }
    );
  };

  const handleRemoveAsset = (assetId: number) => {
    if (!campaignId) return;

    removeAssetMutation.mutate(
      { assetId },
      {
        onSuccess: () => {
          setAssets((prev) => prev.filter((a) => a.id !== assetId));
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Campaign not found</p>
            <Button asChild className="mt-4">
              <Link href="/campaigns">Back to Campaigns</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Campaign Builder</h1>
          <p className="text-muted-foreground">Build your marketing campaign workflow</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/campaigns">Cancel</Link>
          </Button>
          <Button onClick={handleSave} disabled={updateCampaign.isPending}>
            {updateCampaign.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Campaign
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Campaign Info */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Campaign Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">Campaign Name</Label>
            <Input
              id="name"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="Enter campaign name"
            />
          </div>
          <div>
            <Label htmlFor="description">Description (Optional)</Label>
            <Input
              id="description"
              value={campaignDescription}
              onChange={(e) => setCampaignDescription(e.target.value)}
              placeholder="Enter campaign description"
            />
          </div>
        </CardContent>
      </Card>

      {/* View Mode Toggle */}
      <div className="mb-4 flex gap-2">
        <Button
          variant={viewMode === "timeline" ? "default" : "outline"}
          onClick={() => setViewMode("timeline")}
        >
          <Eye className="mr-2 h-4 w-4" />
          Timeline View
        </Button>
        <Button
          variant={viewMode === "workflow" ? "default" : "outline"}
          onClick={() => setViewMode("workflow")}
        >
          <LinkIcon className="mr-2 h-4 w-4" />
          Workflow View
        </Button>
      </div>

      {/* Timeline View */}
      {viewMode === "timeline" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Campaign Timeline</CardTitle>
              <Button onClick={() => setIsAssetLibraryOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Asset
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {assets.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No assets in this campaign yet</p>
                <p className="text-sm mt-2">Click "Add Asset" to get started</p>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={assets.map((a) => a.id)} strategy={verticalListSortingStrategy}>
                  {assets.map((asset) => (
                    <SortableAssetCard key={asset.id} asset={asset} onRemove={handleRemoveAsset} />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </CardContent>
        </Card>
      )}

      {/* Workflow View */}
      {viewMode === "workflow" && campaignId && (
        <WorkflowCanvas campaignId={campaignId} assets={assets} />
      )}

      {/* Asset Library Modal */}
      <AssetLibrary
        isOpen={isAssetLibraryOpen}
        onClose={() => setIsAssetLibraryOpen(false)}
        onAddAsset={handleAddAsset}
      />
    </div>
  );
}
