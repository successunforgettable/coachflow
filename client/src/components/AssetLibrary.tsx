import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, Search } from "lucide-react";

interface AssetLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  onAddAsset: (assetId: string, assetType: string) => void;
}

export function AssetLibrary({ isOpen, onClose, onAddAsset }: AssetLibraryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");

  // Fetch all generator outputs
  const { data: headlines } = trpc.headlines.list.useQuery();
  const { data: hvcoTitles } = trpc.hvco.list.useQuery();
  const { data: heroMechanisms } = trpc.heroMechanisms.list.useQuery();
  const { data: icps } = trpc.icps.list.useQuery();
  const { data: adCopies } = trpc.adCopy.list.useQuery();
  const { data: emailSequences } = trpc.emailSequences.list.useQuery();
  const { data: whatsappSequences } = trpc.whatsappSequences.list.useQuery();
  const { data: landingPages } = trpc.landingPages.list.useQuery();
  const { data: offers } = trpc.offers.list.useQuery();

  const assetTypes = [
    { id: "all", label: "All Assets", color: "bg-gray-500" },
    { id: "headline", label: "Headlines", color: "bg-blue-500" },
    { id: "hvco", label: "Your Free Opt-In", color: "bg-purple-500" },
    { id: "hero_mechanism", label: "Your Unique Method", color: "bg-pink-500" },
    { id: "icp", label: "Your Ideal Customer", color: "bg-green-500" },
    { id: "ad_copy", label: "Your Ads", color: "bg-yellow-500" },
    { id: "email_sequence", label: "Email Sequences", color: "bg-red-500" },
    { id: "whatsapp_sequence", label: "WhatsApp Sequences", color: "bg-teal-500" },
    { id: "landing_page", label: "Landing Pages", color: "bg-indigo-500" },
    { id: "offer", label: "Offers", color: "bg-orange-500" },
  ];

  // Combine all assets into a single list
  const allAssets = [
    ...(headlines?.map((h: any) => ({ id: h.headlineSetId || h.id, type: "headline", title: `Headlines #${h.headlineSetId || h.id}`, createdAt: h.createdAt })) || []),
    ...(hvcoTitles?.map((h: any) => ({ id: h.hvcoSetId || h.id, type: "hvco", title: `Free Opt-In #${h.hvcoSetId || h.id}`, createdAt: h.createdAt })) || []),
    ...(heroMechanisms?.map((h: any) => ({ id: h.mechanismSetId || h.id, type: "hero_mechanism", title: `Unique Method #${h.mechanismSetId || h.id}`, createdAt: h.createdAt })) || []),
    ...(icps?.map((i: any) => ({ id: i.id, type: "icp", title: `Ideal Customer: ${i.name}`, createdAt: i.createdAt })) || []),
    ...(adCopies?.map((a: any) => ({ id: a.adSetId || a.id, type: "ad_copy", title: `Your Ads #${a.adSetId || a.id}`, createdAt: a.createdAt })) || []),
    ...(emailSequences?.map((e: any) => ({ id: e.sequenceId || e.id, type: "email_sequence", title: `Email Sequence #${e.sequenceId || e.id}`, createdAt: e.createdAt })) || []),
    ...(whatsappSequences?.map((w: any) => ({ id: w.sequenceId || w.id, type: "whatsapp_sequence", title: `WhatsApp Sequence #${w.sequenceId || w.id}`, createdAt: w.createdAt })) || []),
    ...(landingPages?.map((l: any) => ({ id: l.landingPageId || l.id, type: "landing_page", title: `Landing Page #${l.landingPageId || l.id}`, createdAt: l.createdAt })) || []),
    ...(offers?.map((o: any) => ({ id: o.offerId || o.id, type: "offer", title: `Offer #${o.offerId || o.id}`, createdAt: o.createdAt })) || []),
  ];

  // Filter assets
  const filteredAssets = allAssets.filter((asset) => {
    const matchesType = selectedType === "all" || asset.type === selectedType;
    const matchesSearch = asset.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  // Sort by creation date (newest first)
  const sortedAssets = filteredAssets.sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const handleAddAsset = (assetId: string | number, assetType: string) => {
    onAddAsset(assetId.toString(), assetType);
    onClose();
  };

  const getAssetTypeColor = (type: string) => {
    const typeConfig = assetTypes.find((t) => t.id === type);
    return typeConfig?.color || "bg-gray-500";
  };

  const getAssetTypeLabel = (type: string) => {
    const typeConfig = assetTypes.find((t) => t.id === type);
    return typeConfig?.label || type;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Asset Library</DialogTitle>
          <DialogDescription>
            Browse and add generator outputs to your campaign
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search assets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Type Tabs */}
        <Tabs value={selectedType} onValueChange={setSelectedType} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid grid-cols-5 w-full">
            {assetTypes.slice(0, 5).map((type) => (
              <TabsTrigger key={type.id} value={type.id}>
                {type.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsList className="grid grid-cols-5 w-full mt-2">
            {assetTypes.slice(5).map((type) => (
              <TabsTrigger key={type.id} value={type.id}>
                {type.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={selectedType} className="flex-1 overflow-y-auto mt-4">
            {sortedAssets.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No assets found</p>
                <p className="text-sm mt-2">Try adjusting your search or filters</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {sortedAssets.map((asset) => (
                  <Card key={`${asset.type}-${asset.id}`} className="hover:bg-accent/50 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-16 rounded ${getAssetTypeColor(asset.type)}`} />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{asset.title}</div>
                          <Badge variant="secondary" className="mt-1">
                            {getAssetTypeLabel(asset.type)}
                          </Badge>
                          <div className="text-xs text-muted-foreground mt-2">
                            {new Date(asset.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleAddAsset(asset.id, asset.type)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
