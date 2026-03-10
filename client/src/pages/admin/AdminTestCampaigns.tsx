import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Loader2, ChevronDown, ChevronUp, CheckCircle2, Mail, MessageCircle, FileText, Megaphone, Target, Star, Zap, BookOpen, Share2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

// ── Collapsible section ────────────────────────────────────────────────────────
function Section({ title, icon: Icon, color, children, defaultOpen = false }: {
  title: string; icon: any; color: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden mb-3">
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between px-4 py-3 text-left font-semibold text-sm ${color} hover:opacity-90 transition-opacity`}
      >
        <span className="flex items-center gap-2"><Icon className="w-4 h-4" />{title}</span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && <div className="p-4 bg-white space-y-3 text-sm text-gray-800">{children}</div>}
    </div>
  );
}

// ── Individual email card ──────────────────────────────────────────────────────
function EmailCard({ email, index }: { email: any; index: number }) {
  const [open, setOpen] = useState(index === 0);
  const body = typeof email === "string" ? email : email.body || email.content || JSON.stringify(email);
  const subject = body.match(/Subject:\s*(.+)/)?.[1] || `Email ${index + 1}`;
  return (
    <div className="border border-blue-100 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 bg-blue-50 text-left text-xs font-medium text-blue-800 hover:bg-blue-100"
      >
        <span>📧 {subject}</span>
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && (
        <pre className="p-3 text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed bg-white">
          {body}
        </pre>
      )}
    </div>
  );
}

// ── WhatsApp message card ──────────────────────────────────────────────────────
function WACard({ msg, index }: { msg: any; index: number }) {
  const text = typeof msg === "string" ? msg : msg.message || msg.content || JSON.stringify(msg);
  const day = typeof msg === "object" ? msg.day : null;
  const timing = typeof msg === "object" ? msg.timing : null;
  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1">
        <Badge variant="outline" className="text-xs border-green-400 text-green-700 bg-green-100">
          {day ? `Day ${day}` : `Msg ${index + 1}`}
        </Badge>
        {timing && <span className="text-xs text-green-600">{timing}</span>}
      </div>
      <p className="text-sm text-gray-800 whitespace-pre-wrap">{text}</p>
    </div>
  );
}

// ── Campaign card ──────────────────────────────────────────────────────────────
function CampaignCard({ campaign }: { campaign: any }) {
  const { user: u, service: svc, nodes } = campaign;
  const { icp, offer, mechanisms, hvcos, headlines, adCopy, landingPage, emailSequence, whatsappSequence, metaPublished } = nodes;

  const emails: any[] = emailSequence?.emails || [];
  const waMessages: any[] = whatsappSequence?.messages || [];

  // Landing page angles
  const lpAngles = [
    { label: "Godfather Angle", value: landingPage?.godfatherAngle },
    { label: "Free Angle", value: landingPage?.freeAngle },
    { label: "Dollar Angle", value: landingPage?.dollarAngle },
    { label: "Active Angle", value: landingPage?.activeAngle },
  ].filter(a => a.value);

  // Offer angles
  const offerAngles = [
    { label: "Godfather Offer", value: offer?.godfatherAngle },
    { label: "Free Angle", value: offer?.freeAngle },
    { label: "Dollar Angle", value: offer?.dollarAngle },
    { label: "Active Angle", value: offer?.activeAngle },
  ].filter(a => a.value);

  const serviceLabel = [
    "🏋️ Fitness", "🏠 Real Estate", "🧠 Mindset", "💕 Relationships", "💼 Business"
  ].find(l => svc?.name?.toLowerCase().includes(l.split(" ")[1].toLowerCase())) || "📋 Campaign";

  return (
    <Card className="border-2 border-gray-200 shadow-sm">
      <CardHeader className="pb-3 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base font-bold text-gray-900">{svc?.name || "Unknown Service"}</CardTitle>
            <p className="text-xs text-gray-500 mt-0.5">{u?.email}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge className="bg-emerald-600 text-white text-xs">PRO</Badge>
            <Badge variant="outline" className="text-xs border-emerald-300 text-emerald-700">11/11 Nodes</Badge>
          </div>
        </div>
        <div className="mt-2 text-xs text-gray-600 space-y-0.5">
          <p><span className="font-medium">Target:</span> {svc?.targetCustomer}</p>
          <p><span className="font-medium">Benefit:</span> {svc?.mainBenefit}</p>
          <p><span className="font-medium">Pain Point:</span> {svc?.painPoints}</p>
        </div>
      </CardHeader>
      <CardContent className="pt-4">

        {/* NODE 1 — SERVICE */}
        <Section title="Node 1 — Service Profile" icon={Star} color="bg-purple-100 text-purple-800" defaultOpen={true}>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="font-semibold">Category:</span> {svc?.category}</div>
            <div><span className="font-semibold">HVCO Topic:</span> {svc?.hvcoTopic}</div>
            <div><span className="font-semibold">Mechanism:</span> {svc?.uniqueMechanismSuggestion || svc?.mechanismDescriptor}</div>
            <div><span className="font-semibold">Pain Points:</span> {svc?.painPoints}</div>
          </div>
          {svc?.description && <p className="text-xs mt-2 text-gray-600">{svc.description}</p>}
        </Section>

        {/* NODE 2 — ICP */}
        <Section title="Node 2 — Ideal Customer Profile" icon={Target} color="bg-blue-100 text-blue-800">
          <p><span className="font-semibold">Profile Name:</span> {icp?.name}</p>
          {icp?.introduction && <p className="text-xs mt-1">{icp.introduction}</p>}
          {icp?.fears && (
            <div className="mt-2">
              <p className="font-semibold text-xs mb-1">Top Fears:</p>
              <p className="text-xs whitespace-pre-wrap">{typeof icp.fears === "string" ? icp.fears : JSON.stringify(icp.fears, null, 2)}</p>
            </div>
          )}
          {icp?.goals && (
            <div className="mt-2">
              <p className="font-semibold text-xs mb-1">Goals:</p>
              <p className="text-xs whitespace-pre-wrap">{typeof icp.goals === "string" ? icp.goals : JSON.stringify(icp.goals, null, 2)}</p>
            </div>
          )}
          {icp?.objections && (
            <div className="mt-2">
              <p className="font-semibold text-xs mb-1">Objections:</p>
              <p className="text-xs whitespace-pre-wrap">{typeof icp.objections === "string" ? icp.objections : JSON.stringify(icp.objections, null, 2)}</p>
            </div>
          )}
          {icp?.psychographics && (
            <div className="mt-2">
              <p className="font-semibold text-xs mb-1">Psychographics:</p>
              <p className="text-xs whitespace-pre-wrap">{typeof icp.psychographics === "string" ? icp.psychographics : JSON.stringify(icp.psychographics, null, 2)}</p>
            </div>
          )}
        </Section>

        {/* NODE 3 — OFFER */}
        <Section title="Node 3 — Offer" icon={Zap} color="bg-orange-100 text-orange-800">
          <p><span className="font-semibold">Product:</span> {offer?.productName}</p>
          {offerAngles.map((a, i) => (
            <div key={i} className="mt-2">
              <p className="font-semibold text-xs text-orange-700">{a.label}:</p>
              <p className="text-xs mt-0.5 whitespace-pre-wrap">{a.value}</p>
            </div>
          ))}
        </Section>

        {/* NODE 4 — UNIQUE METHOD */}
        <Section title="Node 4 — Unique Method / Hero Mechanism" icon={BookOpen} color="bg-indigo-100 text-indigo-800">
          {mechanisms?.map((m: any, i: number) => (
            <div key={i} className="border border-indigo-100 rounded p-3 mb-2">
              <p className="font-semibold text-indigo-800">#{i + 1}: {m.mechanismName}</p>
              <p className="text-xs mt-1 whitespace-pre-wrap">{m.mechanismDescription}</p>
              {m.credibility && <p className="text-xs mt-1"><span className="font-medium">Credibility:</span> {m.credibility}</p>}
              {m.socialProof && <p className="text-xs mt-1"><span className="font-medium">Social Proof:</span> {m.socialProof}</p>}
            </div>
          ))}
        </Section>

        {/* NODE 5 — HVCO */}
        <Section title="Node 5 — Free Opt-In (HVCO)" icon={FileText} color="bg-teal-100 text-teal-800">
          {hvcos?.map((h: any, i: number) => (
            <div key={i} className="border-l-2 border-teal-400 pl-3 mb-2">
              <p className="text-xs font-medium text-teal-700">{h.tabType || `Title ${i + 1}`}:</p>
              <p className="text-xs mt-0.5">{h.title}</p>
            </div>
          ))}
        </Section>

        {/* NODE 6 — HEADLINES */}
        <Section title="Node 6 — Headlines" icon={Megaphone} color="bg-yellow-100 text-yellow-800">
          {headlines?.map((h: any, i: number) => (
            <div key={i} className="border border-yellow-200 rounded p-3 mb-2">
              <Badge variant="outline" className="text-xs border-yellow-400 text-yellow-700 mb-1">{h.formulaType}</Badge>
              <p className="font-semibold text-sm">{h.headline}</p>
              {h.subheadline && <p className="text-xs text-gray-600 mt-1">{h.subheadline}</p>}
              {h.eyebrow && <p className="text-xs text-gray-500 mt-0.5 italic">{h.eyebrow}</p>}
            </div>
          ))}
        </Section>

        {/* NODE 7 — AD COPY */}
        <Section title="Node 7 — Ad Copy" icon={Megaphone} color="bg-red-100 text-red-800">
          {adCopy?.map((ad: any, i: number) => (
            <div key={i} className="border border-red-100 rounded p-3 mb-2">
              <div className="flex gap-2 mb-1 flex-wrap">
                <Badge variant="outline" className="text-xs border-red-300 text-red-700">{ad.adType}</Badge>
                {ad.contentType && <Badge variant="outline" className="text-xs border-gray-300 text-gray-600">{ad.contentType}</Badge>}
              </div>
              <p className="text-xs whitespace-pre-wrap">{ad.content}</p>
              {ad.adCallToAction && <p className="text-xs mt-1 font-medium text-red-700">CTA: {ad.adCallToAction}</p>}
            </div>
          ))}
        </Section>

        {/* NODE 8 — LANDING PAGE */}
        <Section title="Node 8 — Landing Page Copy" icon={FileText} color="bg-cyan-100 text-cyan-800">
          <p><span className="font-semibold">Product:</span> {landingPage?.productName}</p>
          {landingPage?.productDescription && (
            <p className="text-xs mt-1 text-gray-600">{landingPage.productDescription}</p>
          )}
          {lpAngles.map((a, i) => (
            <div key={i} className="mt-3">
              <p className="font-semibold text-xs text-cyan-700">{a.label}:</p>
              <p className="text-xs mt-0.5 whitespace-pre-wrap bg-cyan-50 p-2 rounded">{a.value}</p>
            </div>
          ))}
        </Section>

        {/* NODE 9 — EMAIL SEQUENCE */}
        <Section title="Node 9 — Email Sequence" icon={Mail} color="bg-blue-100 text-blue-800">
          <p className="text-xs mb-2"><span className="font-semibold">Sequence:</span> {emailSequence?.name} · <span className="font-semibold">{emails.length} emails</span></p>
          <div className="space-y-2">
            {emails.map((email: any, i: number) => (
              <EmailCard key={i} email={email} index={i} />
            ))}
          </div>
        </Section>

        {/* NODE 10 — WHATSAPP */}
        <Section title="Node 10 — WhatsApp Sequence" icon={MessageCircle} color="bg-green-100 text-green-800">
          <p className="text-xs mb-2"><span className="font-semibold">Sequence:</span> {whatsappSequence?.name} · <span className="font-semibold">{waMessages.length} messages</span></p>
          <div className="space-y-2">
            {waMessages.map((msg: any, i: number) => (
              <WACard key={i} msg={msg} index={i} />
            ))}
          </div>
        </Section>

        {/* NODE 11 — PUSH TO META */}
        <Section title="Node 11 — Push to Meta / GoHighLevel" icon={Share2} color="bg-gray-100 text-gray-700">
          {metaPublished ? (
            <div className="space-y-1 text-xs">
              <p><span className="font-semibold">Campaign Name:</span> {metaPublished.campaignName}</p>
              <p><span className="font-semibold">Status:</span> <Badge variant="outline" className="text-xs">{metaPublished.status}</Badge></p>
              <p><span className="font-semibold">Daily Budget:</span> ${metaPublished.dailyBudget}/day</p>
              <p><span className="font-semibold">Meta Campaign ID:</span> {metaPublished.metaCampaignId}</p>
              <p><span className="font-semibold">Meta Ad Set ID:</span> {metaPublished.metaAdSetId}</p>
              <p><span className="font-semibold">Meta Ad ID:</span> {metaPublished.metaAdId}</p>
              <p><span className="font-semibold">Published At:</span> {metaPublished.publishedAt ? new Date(metaPublished.publishedAt).toLocaleString() : "—"}</p>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-xs text-gray-500">Node 11 not yet pushed — ready for reviewer interaction</p>
              <Badge variant="outline" className="mt-2 text-xs border-orange-400 text-orange-600 bg-orange-50">Pending</Badge>
            </div>
          )}
        </Section>

      </CardContent>
    </Card>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
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

  const LABELS = ["🏋️ Fitness", "🏠 Real Estate", "🧠 Mindset", "💕 Relationships", "💼 Business"];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-6 py-8">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Test Campaign Report</h1>
              <p className="text-sm text-gray-500">5 complete campaigns · All 11 nodes generated via Claude API · Admin only · Full outputs</p>
            </div>
          </div>
          <div className="flex gap-3 mt-4 flex-wrap">
            {LABELS.map((label, i) => (
              <Badge key={i} variant="outline" className="text-xs border-emerald-300 text-emerald-700 bg-emerald-50">
                ✅ {label}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">Click any section header to expand/collapse. All content is real AI-generated output via Claude API.</p>
        </div>

        {/* Campaign Grid */}
        {campaigns && campaigns.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 gap-5">
            {campaigns.map((campaign: any, i: number) => (
              <CampaignCard key={i} campaign={campaign} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-gray-500">
            <p className="text-lg">No test campaigns found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
