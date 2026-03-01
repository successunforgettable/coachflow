import { useState } from "react";
import { trpc } from "@/lib/trpc";

const ZAP_LOGO =
  "https://files.manuscdn.com/user_upload_by_module/session_file/310419663026750612/GFyyklkYbPvEBkLS.png";

type CampaignType = "webinar" | "challenge" | "course_launch" | "product_launch";

interface Stage1Props {
  onComplete: (data: {
    programName: string;
    campaignType: CampaignType;
    serviceId: number;
    campaignId: number;
  }) => void;
}

const CAMPAIGN_TILES: { type: CampaignType; emoji: string; label: string }[] = [
  { type: "webinar", emoji: "🎙", label: "I'm running a webinar" },
  { type: "challenge", emoji: "🔥", label: "I'm running a challenge" },
  { type: "course_launch", emoji: "📚", label: "I'm launching a course" },
  { type: "product_launch", emoji: "🚀", label: "I'm launching a product" },
];

// Map campaign type to service category
const CATEGORY_MAP: Record<CampaignType, "speaking" | "coaching" | "consulting"> = {
  webinar: "speaking",
  challenge: "coaching",
  course_launch: "coaching",
  product_launch: "consulting",
};

const PROGRESS_DOTS = [true, false, false, false, false];

export function Stage1Questions({ onComplete }: Stage1Props) {
  const [programName, setProgramName] = useState("");
  const [selectedType, setSelectedType] = useState<CampaignType | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createService = trpc.services.create.useMutation();
  const createCampaign = trpc.campaigns.create.useMutation();
  const updateStage = trpc.onboarding.updateStageFlag.useMutation();

  const showQ2 = programName.trim().length > 0;

  async function handleTileSelect(type: CampaignType) {
    if (isCreating) return;
    setSelectedType(type);
    setError(null);
    setIsCreating(true);

    try {
      const category = CATEGORY_MAP[type];

      // Create service with minimal fields — placeholders never shown to user
      const serviceResult = await createService.mutateAsync({
        name: programName.trim(),
        category,
        description: programName.trim(),
        targetCustomer: "To be defined",
        mainBenefit: "To be defined",
      });

      const serviceId = serviceResult.id;

      // Create campaign linked to the service
      const campaignTypeLabels: Record<CampaignType, string> = {
        webinar: "Webinar Campaign",
        challenge: "Challenge Campaign",
        course_launch: "Course Launch Campaign",
        product_launch: "Product Launch Campaign",
      };
      const campaignResult = await createCampaign.mutateAsync({
        name: `${programName.trim()} — ${campaignTypeLabels[type]}`,
        serviceId,
        campaignType: type,
      });

      const campaignId = campaignResult.id;

      // Update onboarding stage to 2
      await updateStage.mutateAsync({ stage: 2 });

      onComplete({ programName: programName.trim(), campaignType: type, serviceId, campaignId });
    } catch (err) {
      console.error("Stage 1 creation error:", err);
      setError("Something went wrong. Please try again.");
      setSelectedType(null);
      setIsCreating(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        padding: "32px 20px 48px",
      }}
    >
      {/* Logo */}
      <div
        style={{
          background: "#1A1624",
          borderRadius: "12px",
          padding: "0 14px",
          height: "44px",
          display: "flex",
          alignItems: "center",
          marginBottom: "28px",
        }}
      >
        <img src={ZAP_LOGO} alt="ZAP" style={{ height: "28px", width: "auto" }} />
      </div>

      {/* Progress dots */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "36px" }}>
        {PROGRESS_DOTS.map((active, i) => (
          <div
            key={i}
            style={{
              width: active ? "24px" : "8px",
              height: "8px",
              borderRadius: "100px",
              background: active ? "var(--charge)" : "var(--ink-4)",
              transition: "all 300ms ease",
            }}
          />
        ))}
      </div>

      {/* Card */}
      <div
        className="zo-card"
        style={{
          width: "100%",
          maxWidth: "480px",
          padding: "32px 28px",
        }}
      >
        {/* Question 1 */}
        <h1
          style={{
            fontSize: "clamp(24px, 5vw, 32px)",
            marginBottom: "8px",
            lineHeight: 1.15,
          }}
        >
          What's your program or offer called?
        </h1>
        <p
          style={{
            fontSize: "14px",
            color: "var(--ink-2)",
            marginBottom: "20px",
            lineHeight: 1.5,
          }}
        >
          This lets ZAP write everything in your voice, about your actual offer.
        </p>
        <input
          type="text"
          value={programName}
          onChange={(e) => setProgramName(e.target.value)}
          placeholder="e.g. The Incredible You Coach Training"
          style={{
            width: "100%",
            borderRadius: "12px",
            border: "1.5px solid var(--ink-4)",
            padding: "16px 18px",
            fontSize: "18px",
            fontFamily: "inherit",
            color: "var(--ink)",
            background: "var(--card-2)",
            outline: "none",
            boxSizing: "border-box",
            transition: "border-color 150ms ease",
          }}
          onFocus={(e) => (e.target.style.borderColor = "var(--charge)")}
          onBlur={(e) => (e.target.style.borderColor = "var(--ink-4)")}
          autoFocus
          disabled={isCreating}
        />

        {/* Question 2 — smooth reveal */}
        {showQ2 && (
          <div className="zo-fade-up" style={{ marginTop: "32px" }}>
            <h2
              style={{
                fontSize: "clamp(20px, 4vw, 26px)",
                marginBottom: "8px",
                lineHeight: 1.2,
              }}
            >
              What are you building this campaign for?
            </h2>
            <p
              style={{
                fontSize: "14px",
                color: "var(--ink-2)",
                marginBottom: "20px",
              }}
            >
              ZAP will tailor every asset to your campaign type.
            </p>

            {/* 2×2 tile grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "12px",
              }}
            >
              {CAMPAIGN_TILES.map(({ type, emoji, label }) => {
                const isSelected = selectedType === type;
                return (
                  <button
                    key={type}
                    onClick={() => handleTileSelect(type)}
                    disabled={isCreating}
                    style={{
                      background: isSelected ? "var(--cg)" : "var(--card)",
                      border: isSelected
                        ? "2px solid var(--charge)"
                        : "1.5px solid var(--ink-4)",
                      borderRadius: "18px",
                      padding: "20px 16px",
                      textAlign: "left",
                      cursor: isCreating ? "not-allowed" : "pointer",
                      transition: "all 150ms ease",
                      opacity: isCreating && !isSelected ? 0.5 : 1,
                    }}
                  >
                    <div style={{ fontSize: "24px", marginBottom: "8px" }}>{emoji}</div>
                    <div
                      style={{
                        fontSize: "15px",
                        fontWeight: 700,
                        color: isSelected ? "var(--charge)" : "var(--ink)",
                        lineHeight: 1.3,
                      }}
                    >
                      {label}
                    </div>
                  </button>
                );
              })}
            </div>

            {isCreating && (
              <p
                style={{
                  textAlign: "center",
                  fontSize: "14px",
                  color: "var(--ink-2)",
                  marginTop: "16px",
                }}
              >
                Setting up your campaign…
              </p>
            )}

            {error && (
              <p
                style={{
                  textAlign: "center",
                  fontSize: "14px",
                  color: "#C0392B",
                  marginTop: "12px",
                }}
              >
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
