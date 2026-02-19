import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { RefreshCw, User, Bell, CreditCard, Shield } from "lucide-react";

export default function Settings() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [showRestartDialog, setShowRestartDialog] = useState(false);

  const resetOnboarding = trpc.onboarding.reset.useMutation({
    onSuccess: () => {
      toast.success("Onboarding reset successfully!");
      setLocation("/onboarding");
    },
    onError: (error) => {
      toast.error(`Failed to reset onboarding: ${error.message}`);
    },
  });

  const handleRestartOnboarding = () => {
    resetOnboarding.mutate();
    setShowRestartDialog(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Settings</h1>
          <p className="text-slate-300">Manage your account preferences and settings</p>
        </div>

        <div className="space-y-6">
          {/* Account Information */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-purple-400" />
                <CardTitle className="text-white">Account Information</CardTitle>
              </div>
              <CardDescription className="text-slate-400">
                Your account details and subscription status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-400">Name</label>
                  <p className="text-white mt-1">{user?.name || "Not set"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-400">Email</label>
                  <p className="text-white mt-1">{user?.email || "Not set"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-400">Subscription Tier</label>
                  <p className="text-white mt-1 capitalize">{user?.subscriptionTier || "trial"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-400">Account Status</label>
                  <p className="text-white mt-1 capitalize">{user?.subscriptionStatus || "active"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Onboarding */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <div className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-purple-400" />
                <CardTitle className="text-white">Onboarding</CardTitle>
              </div>
              <CardDescription className="text-slate-400">
                Restart the guided onboarding wizard to learn the platform again
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => setShowRestartDialog(true)}
                variant="outline"
                className="bg-purple-600 hover:bg-purple-700 text-white border-purple-500"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Restart Onboarding
              </Button>
            </CardContent>
          </Card>

          {/* Notifications (Placeholder) */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-purple-400" />
                <CardTitle className="text-white">Notifications</CardTitle>
              </div>
              <CardDescription className="text-slate-400">
                Manage your notification preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-slate-400 text-sm">
                Notification settings coming soon...
              </p>
            </CardContent>
          </Card>

          {/* Billing (Placeholder) */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-purple-400" />
                <CardTitle className="text-white">Billing & Subscription</CardTitle>
              </div>
              <CardDescription className="text-slate-400">
                Manage your subscription and payment methods
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => setLocation("/pricing")}
                variant="outline"
                className="bg-slate-700 hover:bg-slate-600 text-white border-slate-600"
              >
                View Pricing Plans
              </Button>
            </CardContent>
          </Card>

          {/* Security (Placeholder) */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-purple-400" />
                <CardTitle className="text-white">Security</CardTitle>
              </div>
              <CardDescription className="text-slate-400">
                Manage your account security settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-slate-400 text-sm">
                Security settings coming soon...
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Restart Onboarding Confirmation Dialog */}
      <AlertDialog open={showRestartDialog} onOpenChange={setShowRestartDialog}>
        <AlertDialogContent className="bg-slate-800 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Restart Onboarding?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              This will reset your onboarding progress and take you through the guided wizard again.
              You'll learn how to create services, generate ICPs, create headlines, and build campaigns.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-700 hover:bg-slate-600 text-white border-slate-600">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestartOnboarding}
              disabled={resetOnboarding.isPending}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {resetOnboarding.isPending ? "Restarting..." : "Restart Onboarding"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
