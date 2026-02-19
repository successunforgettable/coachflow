import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { toast as showToast } from "sonner";
import { Shield, Trash2, UserPlus } from "lucide-react";

export function SuperUserManagementCard() {
  const [email, setEmail] = useState("");
  const [revokeUserId, setRevokeUserId] = useState<number | null>(null);

  const { data: superUsers, refetch } = trpc.admin.listSuperUsers.useQuery();
  const createSuperUser = trpc.admin.createSuperUser.useMutation({
    onSuccess: () => {
      showToast.success("Super User Created", {
        description: "User has been granted unlimited access to all generators.",
      });
      setEmail("");
      refetch();
    },
    onError: (error) => {
      showToast.error("Error", {
        description: error.message,
      });
    },
  });

  const revokeSuperUser = trpc.admin.revokeSuperUser.useMutation({
    onSuccess: () => {
      showToast.success("Super User Revoked", {
        description: "User's unlimited access has been removed.",
      });
      setRevokeUserId(null);
      refetch();
    },
    onError: (error) => {
      showToast.error("Error", {
        description: error.message,
      });
    },
  });

  const handleCreate = () => {
    if (!email.trim()) {
      showToast.error("Error", {
        description: "Please enter an email address.",
      });
      return;
    }
    createSuperUser.mutate({ userEmail: email.trim() });
  };

  const handleRevoke = () => {
    if (revokeUserId) {
      revokeSuperUser.mutate({ userId: revokeUserId });
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-purple-500" />
            <CardTitle>Super User Management</CardTitle>
          </div>
          <CardDescription>
            Grant unlimited access to all 9 generators without quota restrictions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Create Super User Form */}
          <div className="space-y-4 rounded-lg border p-4">
            <div className="space-y-2">
              <Label htmlFor="superuser-email">Create Super User</Label>
              <div className="flex gap-2">
                <Input
                  id="superuser-email"
                  type="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
                <Button
                  onClick={handleCreate}
                  disabled={createSuperUser.isPending}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  {createSuperUser.isPending ? "Creating..." : "Create"}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Enter the email of an existing user to grant them super user privileges
              </p>
            </div>
          </div>

          {/* Super Users List */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Current Super Users</h3>
            {!superUsers || superUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No super users yet</p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {superUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          {new Date(user.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setRevokeUserId(user.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Revoke Confirmation Dialog */}
      <AlertDialog open={revokeUserId !== null} onOpenChange={() => setRevokeUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Super User Access?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove unlimited access and restore normal quota limits for this user.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke Access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
