import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Loader2 } from "lucide-react";

const NODE_LABELS = [
  "Node 1 — Service",
  "Node 2 — ICP",
  "Node 3 — Offer",
  "Node 4 — Unique Method",
  "Node 5 — Free Opt-In (HVCO)",
  "Node 6 — Headlines",
  "Node 7 — Ad Copy",
  "Node 8 — Landing Page",
  "Node 9 — Email Sequence",
  "Node 10 — WhatsApp Sequence",
  "Node 11 — Push to Meta",
];

function truncate(text: string | null | undefined, len = 200) {
  if (!text) return "—";
  return text.length > len ? text.slice(0, len) + "…" : text;
}

function NodeSection({ label, complete, children }: { label: string; complete: boolean; children: React.ReactNode }) {
  return (
    <div className="border rounded-lg overflow-hidden mb-3">
      <div className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold ${complete ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
        <CheckCircle className={`w-4 h-4 ${complete ? "text-green-600" : "text-gray-300"}`} />
        {label}
        <Badge variant={complete ? "default" : "secondary"} className={`ml-auto text-xs ${complete ? "bg-green-600" : ""}`}>
          {complete ? "Complete" : "Missing"}
        </Badge>
      </div>
      {complete && (
        <div className="px-4 py-3 text-xs text-gray-700 bg-white space-y-1">
          {children}
        </div>
      )}
    </div>
  );
}

function CampaignCard({ campaign }: { campaign: any }) {
  const { user, service, nodes } = campaign;
  if (!service) return (
    <Card className="border-red-200">
      <CardHeader><CardTitle className="text-sm text-red-600">{user.email} — No service found</CardTitle></CardHeader>
    </Card>
  );

  const { icp, offer, mechanisms, hvcos, headlines, adCopy, landingPage, emailSequence, whatsappSequence, metaPublished } = nodes;
  const completedCount = [service, icp, offer, mechanisms?.length, hvcos?.length, headlines?.length, adCopy?.length, landingPage, emailSequence, whatsappSequence, metaPublished]
    .filter(Boolean).length;

  // Get first ad body copy
  const bodyAd = adCopy?.find((a: any) => a.contentType === "body");
  const headlineAd = adCopy?.find((a: any) => a.contentType === "headline");

  // Get email subjects
  const emailSubjects = emailSequence?.emails?.slice(0, 3).map((e: any) => e.subject).join(" | ");

  // Get whatsapp messages
  const waMsg = whatsappSequence?.messages?.[0]?.message;

  // Landing page headline
  const lpContent = landingPage?.originalAngle;
  const lpHeadline = typeof lpContent === "object" ? lpContent?.headline : null;

  return (
    <Card className="border-gray-200">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-bold text-gray-900">{service.name}</CardTitle>
          <Badge className="bg-emerald-600 text-white text-xs">{completedCount}/11 Nodes</Badge>
        </div>
        <p className="text-xs text-gray-500">{user.email} · Pro · Expires {user.subscriptionEndsAt ? new Date(user.subscriptionEndsAt).toLocaleDateString() : "N/A"}</p>
        <p className="text-xs text-gray-600 mt-1"><span className="font-medium">Target:</span> {service.targetCustomer} · <span className="font-medium">Benefit:</span> {service.mainBenefit}</p>
      </CardHeader>
      <CardContent className="pt-0">
        <NodeSection label={NODE_LABELS[0]} complete={!!service}>
          <p><span className="font-medium">Service:</span> {service.name}</p>
          <p><span className="font-medium">Category:</span> {service.category}</p>
          <p><span className="font-medium">HVCO Topic:</span> {service.hvcoTopic}</p>
          <p><span className="font-medium">Mechanism:</span> {service.uniqueMechanismSuggestion}</p>
        </NodeSection>

        <NodeSection label={NODE_LABELS[1]} complete={!!icp}>
          <p><span className="font-medium">Profile Name:</span> {icp?.name}</p>
          <p><span className="font-medium">Introduction:</span> {truncate(icp?.introduction, 300)}</p>
          <p><span className="font-medium">Top Fears:</span> {truncate(icp?.fears, 150)}</p>
        </NodeSection>

        <NodeSection label={NODE_LABELS[2]} complete={!!offer}>
          <p><span className="font-medium">Product:</span> {offer?.productName}</p>
          <p><span className="font-medium">Godfather Offer:</span> {truncate(typeof offer?.godfatherAngle === "object" ? offer?.godfatherAngle?.offerName : null, 150)}</p>
          <p><span className="font-medium">Headline:</span> {truncate(typeof offer?.godfatherAngle === "object" ? offer?.godfatherAngle?.headline : null, 150)}</p>
        </NodeSection>

        <NodeSection label={NODE_LABELS[3]} complete={!!(mechanisms?.length)}>
          {mechanisms?.slice(0, 2).map((m: any, i: number) => (
            <p key={i}><span className="font-medium">#{i + 1}:</span> {m.mechanismName} — {truncate(m.mechanismDescription, 120)}</p>
          ))}
        </NodeSection>

        <NodeSection label={NODE_LABELS[4]} complete={!!(hvcos?.length)}>
          {hvcos?.slice(0, 3).map((h: any, i: number) => (
            <p key={i}><span className="font-medium">{h.tabType}:</span> {h.title}</p>
          ))}
        </NodeSection>

        <NodeSection label={NODE_LABELS[5]} complete={!!(headlines?.length)}>
          {headlines?.slice(0, 3).map((h: any, i: number) => (
            <p key={i}><span className="font-medium">{h.formulaType}:</span> {truncate(h.headline, 100)}</p>
          ))}
        </NodeSection>

        <NodeSection label={NODE_LABELS[6]} complete={!!(adCopy?.length)}>
          {headlineAd && <p><span className="font-medium">Headline:</span> {headlineAd.content}</p>}
          {bodyAd && <p><span className="font-medium">Body:</span> {truncate(bodyAd.content, 200)}</p>}
        </NodeSection>

        <NodeSection label={NODE_LABELS[7]} complete={!!landingPage}>
          {lpHeadline && <p><span className="font-medium">Headline:</span> {truncate(lpHeadline, 150)}</p>}
          <p><span className="font-medium">Product:</span> {landingPage?.productName}</p>
        </NodeSection>

        <NodeSection label={NODE_LABELS[8]} complete={!!emailSequence}>
          <p><span className="font-medium">Sequence:</span> {emailSequence?.name}</p>
          <p><span className="font-medium">Emails:</span> {emailSequence?.emails?.length} emails</p>
          <p><span className="font-medium">Subjects:</span> {truncate(emailSubjects, 200)}</p>
        </NodeSection>

        <NodeSection label={NODE_LABELS[9]} complete={!!whatsappSequence}>
          <p><span className="font-medium">Sequence:</span> {whatsappSequence?.name}</p>
          <p><span className="font-medium">Messages:</span> {whatsappSequence?.messages?.length} messages</p>
          <p><span className="font-medium">First message:</span> {truncate(waMsg, 150)}</p>
        </NodeSection>

        <NodeSection label={NODE_LABELS[10]} complete={!!metaPublished}>
          <p><span className="font-medium">Campaign:</span> {metaPublished?.campaignName}</p>
          <p><span className="font-medium">Status:</span> {metaPublished?.status}</p>
          <p><span className="font-medium">Budget:</span> ${metaPublished?.dailyBudget}/day</p>
          <p><span className="font-medium">Meta Campaign ID:</span> {metaPublished?.metaCampaignId}</p>
        </NodeSection>
      </CardContent>
    </Card>
  );
}

export default function AdminTestCampaigns() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  const { data: campaigns, isLoading } = trpc.admin.getTestCampaigns.useQuery(undefined, {
    enabled: !authLoading && user?.role === "admin",
  });

  if (!authLoading && user?.role !== "admin") {
    setLocation("/dashboard");
    return null;
  }

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1600px] mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Test Campaign Report</h1>
              <p className="text-sm text-gray-500">5 complete campaigns · All 11 nodes generated via Claude API · Admin only</p>
            </div>
          </div>
          <div className="flex gap-4 mt-4">
            {["Fitness", "Real Estate", "Mindset", "Relationships", "Business"].map((label, i) => (
              <Badge key={i} variant="outline" className="text-xs border-emerald-300 text-emerald-700 bg-emerald-50">
                ✅ {label}
              </Badge>
            ))}
          </div>
        </div>

        {/* Campaign Grid */}
        {campaigns && campaigns.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {campaigns.map((campaign: any, i: number) => (
              <CampaignCard key={i} campaign={campaign} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-gray-500">
            <p className="text-lg">No test campaigns found.</p>
            <p className="text-sm mt-2">Run the generation script to populate test data.</p>
          </div>
        )}
      </div>
    </div>
  );
}
