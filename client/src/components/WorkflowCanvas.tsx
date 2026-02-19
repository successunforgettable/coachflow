import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, X, Link as LinkIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface WorkflowCanvasProps {
  campaignId: number;
  assets: Array<{
    id: number;
    assetId: string;
    assetType: string;
    position: number;
    title?: string;
  }>;
}

interface Link {
  id: number;
  sourceAssetId: number;
  targetAssetId: number;
  linkType: string;
}

export function WorkflowCanvas({ campaignId, assets }: WorkflowCanvasProps) {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [links, setLinks] = useState<Link[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<number | null>(null);
  const [isLinking, setIsLinking] = useState(false);

  const { data: campaignLinks } = trpc.campaigns.listLinks.useQuery(
    { campaignId },
    { enabled: !!campaignId }
  );

  const linkAssetsMutation = trpc.campaigns.linkAssets.useMutation({
    onSuccess: () => {
      toast({ title: "Assets linked successfully" });
      setIsLinking(false);
      setSelectedAsset(null);
    },
    onError: (error) => {
      toast({ title: "Failed to link assets", description: error.message, variant: "destructive" });
    },
  });

  const unlinkAssetsMutation = trpc.campaigns.unlinkAssets.useMutation({
    onSuccess: () => {
      toast({ title: "Link removed successfully" });
    },
  });

  useEffect(() => {
    if (campaignLinks) {
      setLinks(campaignLinks as Link[]);
    }
  }, [campaignLinks]);

  const handleAssetClick = (assetId: number) => {
    if (!isLinking) {
      setSelectedAsset(assetId);
      setIsLinking(true);
    } else if (selectedAsset && selectedAsset !== assetId) {
      // Create link
      linkAssetsMutation.mutate({
        campaignId,
        sourceAssetId: selectedAsset,
        targetAssetId: assetId,
        linkType: "leads_to",
      });
    } else {
      // Cancel linking
      setIsLinking(false);
      setSelectedAsset(null);
    }
  };

  const handleRemoveLink = (linkId: number) => {
    unlinkAssetsMutation.mutate({ linkId }, {
      onSuccess: () => {
        setLinks((prev) => prev.filter((l) => l.id !== linkId));
      },
    });
  };

  const getAssetTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      headline: "bg-blue-500",
      hvco: "bg-purple-500",
      hero_mechanism: "bg-pink-500",
      icp: "bg-green-500",
      ad_copy: "bg-yellow-500",
      email_sequence: "bg-red-500",
      whatsapp_sequence: "bg-teal-500",
      landing_page: "bg-indigo-500",
      offer: "bg-orange-500",
    };
    return colors[type] || "bg-gray-500";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Workflow Canvas</CardTitle>
          {isLinking && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsLinking(false);
                setSelectedAsset(null);
              }}
            >
              Cancel Linking
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {isLinking
            ? "Click on another asset to create a link"
            : "Click on an asset to start linking"}
        </p>
      </CardHeader>
      <CardContent>
        <div ref={canvasRef} className="relative min-h-[600px] bg-muted/20 rounded-lg p-8">
          {/* Assets as nodes */}
          <div className="grid grid-cols-3 gap-8">
            {assets.map((asset, index) => {
              const isSelected = selectedAsset === asset.id;
              const hasOutgoingLink = links.some((l) => l.sourceAssetId === asset.id);
              const hasIncomingLink = links.some((l) => l.targetAssetId === asset.id);

              return (
                <div
                  key={asset.id}
                  className={`relative ${isLinking ? "cursor-pointer" : ""}`}
                  onClick={() => handleAssetClick(asset.id)}
                >
                  <Card
                    className={`transition-all ${
                      isSelected
                        ? "ring-2 ring-primary shadow-lg"
                        : "hover:shadow-md"
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-16 rounded ${getAssetTypeColor(asset.assetType)}`} />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate text-sm">
                            {asset.title || `Asset #${asset.assetId}`}
                          </div>
                          <Badge variant="secondary" className="mt-1 text-xs">
                            {asset.assetType.replace("_", " ")}
                          </Badge>
                          <div className="flex gap-1 mt-2">
                            {hasIncomingLink && (
                              <Badge variant="outline" className="text-xs">
                                ← In
                              </Badge>
                            )}
                            {hasOutgoingLink && (
                              <Badge variant="outline" className="text-xs">
                                Out →
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>

          {/* Links visualization */}
          {links.length > 0 && (
            <div className="mt-6 space-y-2">
              <h4 className="text-sm font-medium">Connections</h4>
              {links.map((link) => {
                const sourceAsset = assets.find((a) => a.id === link.sourceAssetId);
                const targetAsset = assets.find((a) => a.id === link.targetAssetId);

                return (
                  <div
                    key={link.id}
                    className="flex items-center gap-2 p-2 bg-background rounded-md"
                  >
                    <Badge variant="secondary" className="text-xs">
                      {sourceAsset?.assetType || "Unknown"}
                    </Badge>
                    <LinkIcon className="h-4 w-4 text-muted-foreground" />
                    <Badge variant="secondary" className="text-xs">
                      {targetAsset?.assetType || "Unknown"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-auto h-6 w-6"
                      onClick={() => handleRemoveLink(link.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {assets.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              <p>No assets in this campaign yet</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
