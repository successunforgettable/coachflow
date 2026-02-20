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

interface SkipConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmSkip: () => void;
}

export default function SkipConfirmationDialog({
  open,
  onOpenChange,
  onConfirmSkip,
}: SkipConfirmationDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure you want to skip?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-4 text-left">
            <p>
              Setup takes less than 10 minutes and creates your first complete marketing campaign automatically. Without it, you'll be starting from a blank page every time.
            </p>
            
            <div className="space-y-2">
              <p className="font-semibold text-foreground">Here's what you'll miss if you skip:</p>
              <ul className="space-y-1 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-destructive mt-0.5">✗</span>
                  <span>Your Dream Buyer profile — the foundation of all your copy</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-destructive mt-0.5">✗</span>
                  <span>25 ready-to-use headlines built for your specific offer</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-destructive mt-0.5">✗</span>
                  <span>Your first campaign, organised and ready to build on</span>
                </li>
              </ul>
            </div>

            <p className="text-xs text-muted-foreground">
              You can always restart setup from Settings, but most coaches who skip never come back to it.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogAction
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto bg-gradient-to-br from-[#8B5CF6] to-[#A78BFA] hover:shadow-[0_0_20px_rgba(139,92,246,0.4)]"
          >
            Finish Setup (5 min)
          </AlertDialogAction>
          <AlertDialogCancel
            onClick={onConfirmSkip}
            className="w-full sm:w-auto"
          >
            Skip Anyway
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
