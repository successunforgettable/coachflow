import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { X } from "lucide-react";

interface RegenerateSidebarProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onRegenerate: () => void;
  onCancel?: () => void;
  isLoading?: boolean;
  creditText?: string;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function RegenerateSidebar({
  title,
  subtitle,
  children,
  onRegenerate,
  onCancel,
  isLoading = false,
  creditText = "Uses 1 Credit",
  isOpen = true,
  onClose,
}: RegenerateSidebarProps) {
  if (!isOpen) return null;

  return (
    <div className="w-full lg:w-96 flex-shrink-0">
      <Card className="sticky top-4">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg">{title}</CardTitle>
              {subtitle && (
                <CardDescription className="mt-2 text-sm">
                  {subtitle}
                </CardDescription>
              )}
            </div>
            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 -mt-1 -mr-2"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Form fields passed as children */}
          {children}

          {/* Credit usage text */}
          <p className="text-sm text-muted-foreground">{creditText}</p>

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={onRegenerate}
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? "Regenerating..." : "Regenerate"}
            </Button>
            {onCancel && (
              <Button
                variant="ghost"
                onClick={onCancel}
                disabled={isLoading}
              >
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
