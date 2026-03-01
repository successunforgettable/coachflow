import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, CheckCircle2, ChevronRight, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CreateServiceStepProps {
  data: { serviceId?: number };
  onComplete: (data: { serviceId: number }) => void;
  onNext: () => void;
}

// REQUIREMENT 1 — Plain English labels and helper text (Build Plan March 1 2026)
const REVIEW_FIELDS = [
  {
    key: "painPoints" as const,
    label: "What problems your customer faces",
    helper: "The specific frustrations your customer feels every day — in their own words.",
    rows: 3,
  },
  {
    key: "falseBeliefsVsRealReasons" as const,
    label: "What they think is stopping them — and what really is",
    helper: "The excuse they tell themselves vs the real reason they haven't solved it yet.",
    rows: 3,
  },
  {
    key: "failedSolutions" as const,
    label: "What they have tried before and why it did not work",
    helper: "The other things they've already tried — and exactly why each one let them down.",
    rows: 3,
  },
  {
    key: "hiddenReasons" as const,
    label: "The real reasons behind their problem they would never admit",
    helper: "Deeper truths they may not even be aware of — the root causes they'd never say out loud.",
    rows: 3,
  },
  {
    key: "whyProblemExists" as const,
    label: "Why this problem exists in the first place",
    helper: "The underlying reason this problem keeps happening — not just the symptoms.",
    rows: 2,
  },
  {
    key: "uniqueMechanismSuggestion" as const,
    label: "What to call your method or system",
    helper: "A memorable, proprietary-sounding name for how your service gets results.",
    rows: 1,
  },
  {
    key: "hvcoTopic" as const,
    label: "Your free offer title",
    helper: "A specific lead magnet title that would make your ideal customer want to sign up immediately.",
    rows: 1,
  },
  {
    key: "riskReversal" as const,
    label: "Your guarantee",
    helper: "A compelling promise that removes the risk of buying — so they feel safe saying yes.",
    rows: 2,
  },
  {
    key: "avatarName" as const,
    label: "Your ideal customer's first name",
    helper: "A realistic first name that represents the person you most want to help.",
    rows: 1,
  },
  {
    key: "avatarTitle" as const,
    label: "Your ideal customer's situation in a few words",
    helper: "Their job title or life situation — e.g. 'Aspiring coach, 40s, stuck at a desk job'.",
    rows: 1,
  },
];

type ReviewKey = (typeof REVIEW_FIELDS)[number]["key"];

// REQUIREMENT 6 — Extended stage type (Item 1.1b)
type Stage = "form" | "expanding" | "review" | "angles" | "generating_icps" | "icps_done";

interface AngleSuggestion {
  id: number;
  angleName: string;
  description: string;
  primaryPain: string;
  primaryBuyingTrigger: string;
  status: string | null;
}

interface GeneratedIcp {
  id: number;
  angleName: string | null;
  name: string;
}

export default function CreateServiceStep({ data, onComplete, onNext }: CreateServiceStepProps) {
  const { toast } = useToast();
  const [stage, setStage] = useState<Stage>("form");
  const [serviceId, setServiceId] = useState<number | null>(data.serviceId ?? null);
  const [formData, setFormData] = useState({
    name: "",
    category: "coaching" as "coaching" | "speaking" | "consulting",
    description: "",
    targetCustomer: "",
    mainBenefit: "",
  });
  const [reviewFields, setReviewFields] = useState<Record<ReviewKey, string>>({
    painPoints: "",
    falseBeliefsVsRealReasons: "",
    failedSolutions: "",
    hiddenReasons: "",
    whyProblemExists: "",
    uniqueMechanismSuggestion: "",
    hvcoTopic: "",
    riskReversal: "",
    avatarName: "",
    avatarTitle: "",
  });

  // Item 1.1b — angle suggestion state
  const [angleSuggestions, setAngleSuggestions] = useState<AngleSuggestion[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [maxSelectError, setMaxSelectError] = useState(false);
  const [generatingProgress, setGeneratingProgress] = useState(0);
  const [generatingTotal, setGeneratingTotal] = useState(0);
  const [generatedIcps, setGeneratedIcps] = useState<GeneratedIcp[]>([]);

  const createService = trpc.services.create.useMutation();
  const expandProfile = trpc.services.expandProfile.useMutation();
  const updateService = trpc.services.update.useMutation();
  const generateAngles = trpc.icpAngleSuggestions.generate.useMutation();
  const generateICPs = trpc.icpAngleSuggestions.generateICPs.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Step 1: Create the service record
      const newService = await createService.mutateAsync(formData);
      setServiceId(newService.id);
      onComplete({ serviceId: newService.id });

      // Step 2: Show expanding state immediately
      setStage("expanding");

      // Step 3: Call expandProfile — saves all 10 fields to DB before returning
      const result = await expandProfile.mutateAsync({ serviceId: newService.id });

      // Step 4: Populate review fields from AI output
      setReviewFields({
        painPoints: result.expanded.painPoints || "",
        falseBeliefsVsRealReasons: result.expanded.falseBeliefsVsRealReasons || "",
        failedSolutions: result.expanded.failedSolutions || "",
        hiddenReasons: result.expanded.hiddenReasons || "",
        whyProblemExists: result.expanded.whyProblemExists || "",
        uniqueMechanismSuggestion: result.expanded.uniqueMechanismSuggestion || "",
        hvcoTopic: result.expanded.hvcoTopic || "",
        riskReversal: result.expanded.riskReversal || "",
        avatarName: result.expanded.avatarName || "",
        avatarTitle: result.expanded.avatarTitle || "",
      });

      // Step 5: Show review screen
      setStage("review");
    } catch (err: any) {
      toast({
        title: "Something went wrong",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
      setStage("form");
    }
  };

  // REQUIREMENT 6 — "Looks good →" now triggers angle generation, not onNext()
  const handleReviewConfirm = async () => {
    if (!serviceId) return;
    try {
      // Save any edits the user made on the review screen
      await updateService.mutateAsync({ id: serviceId, ...reviewFields });

      // Transition to angles stage and trigger angle suggestion generation
      setStage("angles");
      const suggestions = await generateAngles.mutateAsync({ serviceId });
      setAngleSuggestions(suggestions as AngleSuggestion[]);
    } catch (err: any) {
      toast({
        title: "Could not generate audience suggestions",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
      // Fall back to calling onNext() so the user is not stuck
      onNext();
    }
  };

  const handleToggleAngle = (id: number) => {
    setMaxSelectError(false);
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((s) => s !== id));
    } else {
      if (selectedIds.length >= 3) {
        setMaxSelectError(true);
        return;
      }
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleBuildProfiles = async () => {
    if (selectedIds.length === 0) return;
    try {
      setGeneratingTotal(selectedIds.length);
      setGeneratingProgress(0);
      setStage("generating_icps");

      // generateICPs processes sequentially server-side; we show progress per item
      // We call once with all IDs and update progress after the call returns
      const icps = await generateICPs.mutateAsync({ suggestionIds: selectedIds });
      setGeneratedIcps(icps as GeneratedIcp[]);
      setGeneratingProgress(selectedIds.length);
      setStage("icps_done");
    } catch (err: any) {
      toast({
        title: "Could not build customer profiles",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
      setStage("angles");
    }
  };

  // ── STAGE: form ──────────────────────────────────────────────────────────────
  if (stage === "form") {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-2xl font-bold mb-2">What transformation do you sell?</h3>
          <p className="text-muted-foreground">
            Be specific. The more precise you are here, the more powerful your AI-generated assets will be.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              Service Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="e.g., Executive Leadership Coaching"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <p className="text-sm text-muted-foreground">What service or program do you offer?</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="targetCustomer">
              Target Customer <span className="text-destructive">*</span>
            </Label>
            <Input
              id="targetCustomer"
              placeholder="e.g., C-suite executives in tech companies"
              value={formData.targetCustomer}
              onChange={(e) => setFormData({ ...formData, targetCustomer: e.target.value })}
              required
            />
            <p className="text-sm text-muted-foreground">Who is your ideal customer?</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mainBenefit">
              Main Benefit <span className="text-destructive">*</span>
            </Label>
            <Input
              id="mainBenefit"
              placeholder="e.g., Increase leadership effectiveness by 40%"
              value={formData.mainBenefit}
              onChange={(e) => setFormData({ ...formData, mainBenefit: e.target.value })}
              required
            />
            <p className="text-sm text-muted-foreground">What's the key transformation or result?</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">
              Service Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="description"
              placeholder="Describe your service, key benefits, and what makes it unique..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              required
            />
            <p className="text-sm text-muted-foreground">Provide details about your service (2-3 sentences)</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-4">
            <h4 className="font-semibold text-sm mb-2">💡 Pro Tips:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Don't say 'business coaching' — say 'I help first-generation entrepreneurs hit their first ₹1 crore in 12 months'</li>
              <li>• Your main benefit should be a result, not a feature — transformation, not information</li>
              <li>• You can add more services later — start with your #1 offer</li>
            </ul>
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={
              createService.isPending ||
              !formData.name ||
              !formData.targetCustomer ||
              !formData.mainBenefit ||
              !formData.description
            }
          >
            {createService.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              "Build My Assets →"
            )}
          </Button>
        </form>
      </div>
    );
  }

  // ── STAGE: expanding ─────────────────────────────────────────────────────────
  if (stage === "expanding") {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-6 text-center">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-10 w-10 text-primary animate-pulse" />
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-bold">AI is building your marketing profile…</h3>
          <p className="text-muted-foreground max-w-sm">
            Analysing your service and generating a complete intelligence profile. This takes about 10 seconds.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Identifying customer pain points, beliefs, and buying triggers…</span>
        </div>
      </div>
    );
  }

  // ── STAGE: review ─────────────────────────────────────────────────────────────
  if (stage === "review") {
    return (
      <div className="space-y-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-6 w-6 text-green-500 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-2xl font-bold mb-1">Your marketing profile is ready</h3>
            <p className="text-muted-foreground">
              AI has built a complete profile for your service. Review each field below — edit anything that doesn't sound right, then click <strong>Looks good →</strong> to continue.
            </p>
          </div>
        </div>

        <div className="space-y-5">
          {REVIEW_FIELDS.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label htmlFor={`review-${field.key}`} className="text-sm font-semibold">
                {field.label}
              </Label>
              <Textarea
                id={`review-${field.key}`}
                value={reviewFields[field.key]}
                onChange={(e) =>
                  setReviewFields((prev) => ({ ...prev, [field.key]: e.target.value }))
                }
                rows={field.rows}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">{field.helper}</p>
            </div>
          ))}
        </div>

        <Button
          className="w-full"
          onClick={handleReviewConfirm}
          disabled={updateService.isPending || generateAngles.isPending}
        >
          {updateService.isPending || generateAngles.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {generateAngles.isPending ? "Finding your audiences…" : "Saving…"}
            </>
          ) : (
            <>
              Looks good →
              <ChevronRight className="h-4 w-4 ml-1" />
            </>
          )}
        </Button>
      </div>
    );
  }

  // ── STAGE: angles ─────────────────────────────────────────────────────────────
  if (stage === "angles") {
    const isLoading = generateAngles.isPending || angleSuggestions.length === 0;

    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-16 space-y-6 text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-10 w-10 text-primary animate-pulse" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-bold">Finding your ideal audiences…</h3>
            <p className="text-muted-foreground max-w-sm">
              Analysing your service to identify 10 distinct types of people who would buy from you.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Mapping audience segments…</span>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-2xl font-bold mb-1">Who do you want to attract?</h3>
          <p className="text-muted-foreground">
            Pick the types of people most likely to buy your program. We'll build a complete customer profile for each one — automatically.
          </p>
        </div>

        <p className="text-sm text-muted-foreground font-medium">
          Select 1 to 3 audiences to target
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {angleSuggestions.map((suggestion) => {
            const isSelected = selectedIds.includes(suggestion.id);
            return (
              <button
                key={suggestion.id}
                type="button"
                onClick={() => handleToggleAngle(suggestion.id)}
                className={[
                  "relative text-left rounded-lg border-2 p-4 transition-all",
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-primary/50",
                ].join(" ")}
              >
                {isSelected && (
                  <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </span>
                )}
                <p className="font-bold text-base leading-tight pr-6">{suggestion.angleName}</p>
                <p className="text-sm text-muted-foreground mt-1">{suggestion.description}</p>
                <p className="text-xs text-muted-foreground/80 italic mt-2">
                  Their main struggle: {suggestion.primaryPain}
                </p>
              </button>
            );
          })}
        </div>

        {maxSelectError && (
          <p className="text-sm text-destructive font-medium">
            Maximum 3 audiences — deselect one to choose another
          </p>
        )}

        <Button
          className="w-full"
          onClick={handleBuildProfiles}
          disabled={selectedIds.length === 0}
        >
          Build my customer profiles →
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    );
  }

  // ── STAGE: generating_icps ────────────────────────────────────────────────────
  if (stage === "generating_icps") {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-6 text-center">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-10 w-10 text-primary animate-pulse" />
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-bold">
            Building customer profile{generatingTotal > 1 ? "s" : ""}…
          </h3>
          <p className="text-muted-foreground max-w-sm">
            {generatingProgress < generatingTotal
              ? `Building customer profile ${generatingProgress + 1} of ${generatingTotal}…`
              : "Finalising profiles…"}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>This takes 15–30 seconds per profile…</span>
        </div>
      </div>
    );
  }

  // ── STAGE: icps_done ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="h-6 w-6 text-green-500 mt-0.5 shrink-0" />
        <div>
          <h3 className="text-2xl font-bold mb-1">Customer profiles built</h3>
          <p className="text-muted-foreground">
            Your AI-generated customer profiles are ready. Every generator will now use the right profile for each campaign.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {generatedIcps.map((icp) => (
          <div key={icp.id} className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
            <span className="font-medium">{icp.angleName || icp.name}</span>
          </div>
        ))}
      </div>

      <Button className="w-full" onClick={onNext}>
        Continue →
        <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );
}
