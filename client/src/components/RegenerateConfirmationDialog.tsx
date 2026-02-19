import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";

interface RegenerateConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  generatorName: string;
  currentCount: number;
  limit: number;
  resetDate?: string;
  isLoading?: boolean;
}

export function RegenerateConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  generatorName,
  currentCount,
  limit,
  resetDate,
  isLoading = false,
}: RegenerateConfirmationDialogProps) {
  const remaining = Math.max(0, limit - currentCount);
  const isUnlimited = limit === Infinity || limit >= 999;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-[#1a1a1a] border-gray-800">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white text-xl">
            Generate 15 More Variations?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-gray-400 space-y-3">
            <p>
              This will create 15 additional {generatorName} variations using the same parameters.
            </p>
            
            {isUnlimited ? (
              <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-3">
                <p className="text-purple-300 font-medium">
                  ✨ Unlimited Generations
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  You have unlimited {generatorName} generations with your current plan.
                </p>
              </div>
            ) : (
              <div className={`rounded-lg p-3 border ${
                remaining > 0 
                  ? 'bg-blue-900/20 border-blue-500/30' 
                  : 'bg-red-900/20 border-red-500/30'
              }`}>
                <p className={`font-medium ${
                  remaining > 0 ? 'text-blue-300' : 'text-red-300'
                }`}>
                  {remaining > 0 
                    ? `${remaining} of ${limit} generations remaining`
                    : `Quota limit reached (${limit} per month)`
                  }
                </p>
                {resetDate && (
                  <p className="text-sm text-gray-400 mt-1">
                    Resets on {resetDate}
                  </p>
                )}
                {remaining === 0 && (
                  <p className="text-sm text-gray-300 mt-2">
                    Upgrade your plan to generate more {generatorName}.
                  </p>
                )}
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel 
            className="bg-gray-800 text-white hover:bg-gray-700 border-gray-700"
            disabled={isLoading}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            className="bg-purple-600 hover:bg-purple-700 text-white"
            disabled={isLoading || (!isUnlimited && remaining === 0)}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              "Confirm"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
