import { Progress } from "@/components/ui/progress";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface QuotaProgressBarProps {
  used: number;
  limit: number;
  label: string;
  resetDate?: Date;
}

export function QuotaProgressBar({ used, limit, label, resetDate }: QuotaProgressBarProps) {
  const percentage = (used / limit) * 100;
  
  // Color-coded warnings: green (0-70%), yellow (71-90%), red (91-100%)
  const getColor = () => {
    if (percentage >= 91) return "bg-red-500";
    if (percentage >= 71) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getTextColor = () => {
    if (percentage >= 91) return "text-red-500";
    if (percentage >= 71) return "text-yellow-500";
    return "text-green-500";
  };

  const formatResetDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{label}</span>
          {resetDate && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-4 h-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Resets on {formatResetDate(resetDate)}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <span className={`text-sm font-semibold ${getTextColor()}`}>
          {used}/{limit} Used
        </span>
      </div>
      <div className="relative">
        <Progress value={percentage} className="h-2" />
        <div
          className={`absolute top-0 left-0 h-2 rounded-full transition-all ${getColor()}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}
