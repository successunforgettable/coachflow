import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";

interface UpgradePromptProps {
  generatorName: string;
  currentTier: "trial" | "pro" | "agency";
  used: number;
  limit: number;
}

export function UpgradePrompt({ generatorName, currentTier, used, limit }: UpgradePromptProps) {
  // Don't show for agency (unlimited)
  if (currentTier === "agency") return null;

  // Don't show if not at limit
  if (used < limit) return null;

  return (
    <Card className="p-4 border-yellow-500/50 bg-yellow-500/10 animate-fade-in">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="font-semibold text-yellow-500 mb-1">
            {generatorName} Quota Limit Reached
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            You've used all {limit} {generatorName.toLowerCase()} for this month. 
            {currentTier === "trial" && " Upgrade to Pro for 50x more generations, or Agency for unlimited."}
            {currentTier === "pro" && " Upgrade to Agency for unlimited generations."}
          </p>
          <Link href="/pricing">
            <Button size="sm" className="bg-green-600 hover:bg-green-700">
              {currentTier === "trial" ? "View Plans" : "Upgrade to Agency"}
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}
