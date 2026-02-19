import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import { Flag, Check, Trash2, AlertTriangle } from "lucide-react";

export function FlaggedContentReview() {
  const [resolveId, setResolveId] = useState<number | null>(null);
  const [deleteContentId, setDeleteContentId] = useState<{ id: number; type: string } | null>(null);

  const { data: flaggedContent, refetch } = trpc.admin.getFlaggedContent.useQuery({ status: "pending" });

  const resolveFlag = trpc.admin.resolveFlaggedContent.useMutation({
    onSuccess: () => {
      toast.success("Flag Resolved", {
        description: "The content flag has been marked as resolved.",
      });
      setResolveId(null);
      refetch();
    },
    onError: (error) => {
      toast.error("Error", {
        description: error.message,
      });
    },
  });

  const deleteContent = trpc.admin.deleteUserContent.useMutation({
    onSuccess: () => {
      toast.success("Content Deleted", {
        description: "The flagged content has been permanently removed.",
      });
      setDeleteContentId(null);
      refetch();
    },
    onError: (error) => {
      toast.error("Error", {
        description: error.message,
      });
    },
  });

  const handleResolve = () => {
    if (resolveId) {
      resolveFlag.mutate({ flagId: resolveId, status: "resolved" });
    }
  };

  const handleDelete = () => {
    if (deleteContentId) {
      deleteContent.mutate({
        contentId: deleteContentId.id,
        contentType: deleteContentId.type as any,
      });
    }
  };

  const getGeneratorLabel = (type: string) => {
    const labels: Record<string, string> = {
      headline: "Headlines",
      hvco: "HVCO Titles",
      heroMechanism: "Hero Mechanisms",
      icp: "ICP",
      adCopy: "Ad Copy",
      email: "Email Sequences",
      whatsapp: "WhatsApp Sequences",
      landingPage: "Landing Pages",
      offer: "Offers",
    };
    return labels[type] || type;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <CardTitle>Flagged Content Review</CardTitle>
          </div>
          <CardDescription>
            Review and moderate content that has been flagged as inappropriate
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!flaggedContent || flaggedContent.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Flag className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No flagged content</p>
            </div>
          ) : (
            <div className="space-y-4">
              {flaggedContent.map((item: any) => (
                <div
                  key={item.id}
                  className="border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-800 rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="bg-yellow-100 dark:bg-yellow-900">
                          {getGeneratorLabel(item.contentType)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Flagged {new Date(item.createdAt).toLocaleString()}
                        </span>
                        <Badge variant="secondary">User ID: {item.userId}</Badge>
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">Reason:</span> {item.reason}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium">Flagged by:</span> Admin (ID: {item.flaggedBy})
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setResolveId(item.id)}
                        className="text-green-600 hover:text-green-700"
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Resolve
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setDeleteContentId({ id: item.contentId, type: item.contentType })
                        }
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resolve Confirmation Dialog */}
      <AlertDialog open={resolveId !== null} onOpenChange={() => setResolveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resolve Flag?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the flag as resolved. The content will remain but the flag will be
              removed from this list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResolve}>Resolve</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteContentId !== null}
        onOpenChange={() => setDeleteContentId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Flagged Content?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the content and resolve the flag. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Content
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
