import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";

interface MetaStatusBadgeProps {
  status: "ACTIVE" | "PAUSED" | "ARCHIVED" | "DELETED" | null;
  campaignName?: string;
  metaCampaignId?: string;
}

export function MetaStatusBadge({ status, campaignName, metaCampaignId }: MetaStatusBadgeProps) {
  if (!status) {
    return (
      <Badge variant="outline" className="text-xs">
        Draft
      </Badge>
    );
  }

  const getVariant = () => {
    switch (status) {
      case "ACTIVE":
        return "default";
      case "PAUSED":
        return "secondary";
      case "ARCHIVED":
      case "DELETED":
        return "outline";
      default:
        return "outline";
    }
  };

  const getColor = () => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-500 hover:bg-green-600";
      case "PAUSED":
        return "bg-yellow-500 hover:bg-yellow-600";
      case "ARCHIVED":
      case "DELETED":
        return "bg-gray-500 hover:bg-gray-600";
      default:
        return "";
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Badge variant={getVariant()} className={`text-xs ${getColor()}`}>
        {status}
      </Badge>
      {metaCampaignId && (
        <a
          href={`https://business.facebook.com/adsmanager/manage/campaigns?act=${metaCampaignId.replace("act_", "")}&selected_campaign_ids=${metaCampaignId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
          title={`View "${campaignName}" in Meta Ads Manager`}
        >
          <ExternalLink className="w-3 h-3" />
          View in Meta
        </a>
      )}
    </div>
  );
}
