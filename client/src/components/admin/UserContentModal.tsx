import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Trash2, Flag, FileText } from "lucide-react";

interface UserContentModalProps {
  userId: number;
  userName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserContentModal({ userId, userName, open, onOpenChange }: UserContentModalProps) {
  const [generatorFilter, setGeneratorFilter] = useState<string>("all");
  const [deleteContentId, setDeleteContentId] = useState<{ id: number; type: string } | null>(null);
  const [flagContentId, setFlagContentId] = useState<{ id: number; type: string } | null>(null);

  const { data: content, refetch } = trpc.admin.getUserContent.useQuery(
    { userId },
    { enabled: open }
  );

  const deleteContent = trpc.admin.deleteUserContent.useMutation({
    onSuccess: () => {
      toast.success("Content Deleted", {
        description: "The content has been permanently removed.",
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

  const flagContent = trpc.admin.flagContent.useMutation({
    onSuccess: () => {
      toast.success("Content Flagged", {
        description: "The content has been marked for review.",
      });
      setFlagContentId(null);
      refetch();
    },
    onError: (error) => {
      toast.error("Error", {
        description: error.message,
      });
    },
  });

  const handleDelete = () => {
    if (deleteContentId) {
      deleteContent.mutate({
        contentId: deleteContentId.id,
        contentType: deleteContentId.type as any,
      });
    }
  };

  const handleFlag = () => {
    if (flagContentId) {
      flagContent.mutate({
        contentId: flagContentId.id,
        contentType: flagContentId.type as any,
        userId: userId,
        reason: "Inappropriate content flagged by admin",
      });
    }
  };

  const filteredContent = content?.filter(
    (item) => generatorFilter === "all" || item.generatorType === generatorFilter
  );

  const getGeneratorLabel = (type: string) => {
    const labels: Record<string, string> = {
      headlines: "Headlines",
      hvco: "HVCO Titles",
      hero: "Hero Mechanisms",
      icps: "ICP",
      adCopy: "Ad Copy",
      emailSequences: "Email Sequences",
      whatsappSequences: "WhatsApp Sequences",
      landingPages: "Landing Pages",
      offers: "Offers",
    };
    return labels[type] || type;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Content for {userName}</DialogTitle>
            <DialogDescription>
              View, flag, or delete all generated content for this user
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Filter by generator:</span>
              <Select value={generatorFilter} onValueChange={setGeneratorFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Generators</SelectItem>
                  <SelectItem value="headlines">Headlines</SelectItem>
                  <SelectItem value="hvco">HVCO Titles</SelectItem>
                  <SelectItem value="hero">Hero Mechanisms</SelectItem>
                  <SelectItem value="icps">ICP</SelectItem>
                  <SelectItem value="adCopy">Ad Copy</SelectItem>
                  <SelectItem value="emailSequences">Email Sequences</SelectItem>
                  <SelectItem value="whatsappSequences">WhatsApp Sequences</SelectItem>
                  <SelectItem value="landingPages">Landing Pages</SelectItem>
                  <SelectItem value="offers">Offers</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Content List */}
            {!filteredContent || filteredContent.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No content found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredContent.map((item) => (
                  <div
                    key={`${item.generatorType}-${item.id}`}
                    className="border rounded-lg p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {getGeneratorLabel(item.generatorType)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(item.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-sm whitespace-pre-wrap break-words">
                          {typeof item.content === "string"
                            ? item.content
                            : JSON.stringify(item.content, null, 2)}
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setFlagContentId({ id: item.id, type: item.generatorType })
                          }
                          className="text-yellow-600 hover:text-yellow-700"
                        >
                          <Flag className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setDeleteContentId({ id: item.id, type: item.generatorType })
                          }
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteContentId !== null}
        onOpenChange={() => setDeleteContentId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Content?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this content. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Flag Confirmation Dialog */}
      <AlertDialog
        open={flagContentId !== null}
        onOpenChange={() => setFlagContentId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Flag Content?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the content as inappropriate and add it to the flagged content list
              for review.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleFlag}>Flag Content</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
