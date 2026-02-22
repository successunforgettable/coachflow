import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { useLocation } from "wouter";

export default function Integrations() {
  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const { data: metaStatus, isLoading, refetch } = trpc.meta.getConnectionStatus.useQuery();
  const { data: oauthUrl } = trpc.meta.getOAuthUrl.useQuery();
  const disconnect = trpc.meta.disconnectMeta.useMutation();

  // Handle OAuth callback success/error
  useEffect(() => {
    const metaSuccess = searchParams.get("meta_success");
    const metaError = searchParams.get("meta_error");

    if (metaSuccess) {
      toast.success("Meta Ads Manager connected successfully!");
      refetch();
      // Clean up URL
      setLocation("/settings/integrations");
    }

    if (metaError) {
      const errorMessages: Record<string, string> = {
        missing_params: "OAuth callback missing required parameters",
        invalid_state: "Invalid OAuth state parameter",
        config_error: "Meta app credentials not configured",
        token_exchange_failed: "Failed to exchange authorization code for token",
        long_lived_token_failed: "Failed to get long-lived access token",
        ad_accounts_failed: "Failed to fetch your Meta ad accounts",
        db_error: "Database error occurred",
        unexpected: "An unexpected error occurred",
      };
      toast.error(errorMessages[metaError] || "Failed to connect Meta Ads Manager");
      // Clean up URL
      setLocation("/settings/integrations");
    }
  }, [searchParams, refetch, setLocation]);

  const handleConnect = () => {
    if (oauthUrl?.url) {
      window.location.href = oauthUrl.url;
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect.mutateAsync();
      toast.success("Meta Ads Manager disconnected");
      refetch();
    } catch (error) {
      toast.error("Failed to disconnect Meta Ads Manager");
    }
  };

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Integrations</h1>
        <p className="text-muted-foreground">
          Connect external platforms to publish and manage your marketing campaigns
        </p>
      </div>

      <div className="space-y-6">
        {/* Meta Ads Manager Integration */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  Meta Ads Manager
                </CardTitle>
                <CardDescription className="mt-2">
                  Publish ads directly to Facebook and Instagram from ZAP
                </CardDescription>
              </div>
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : metaStatus?.connected ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading connection status...
              </div>
            ) : metaStatus?.connected ? (
              <div className="space-y-4">
                <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-green-700 dark:text-green-400">
                        Connected to Meta Ads Manager
                      </p>
                      {metaStatus.adAccountName && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Ad Account: {metaStatus.adAccountName}
                        </p>
                      )}
                      {metaStatus.connectedAt && (
                        <p className="text-sm text-muted-foreground">
                          Connected: {new Date(metaStatus.connectedAt).toLocaleDateString()}
                        </p>
                      )}
                      {metaStatus.expiresAt && (
                        <p className="text-sm text-muted-foreground">
                          Token expires: {new Date(metaStatus.expiresAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    variant="destructive"
                    onClick={handleDisconnect}
                    disabled={disconnect.isPending}
                  >
                    {disconnect.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Disconnect
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => window.open("https://business.facebook.com/adsmanager", "_blank")}
                  >
                    Open Ads Manager
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                </div>

                <div className="rounded-lg bg-muted p-4 text-sm">
                  <p className="font-medium mb-2">What you can do:</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Publish ad copy directly to Meta with one click</li>
                    <li>• View campaign performance data in ZAP</li>
                    <li>• Manage campaigns without leaving ZAP</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg bg-muted p-4 text-sm">
                  <p className="font-medium mb-2">Connect your Meta Ads Manager to:</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Publish ads directly from ZAP to Facebook & Instagram</li>
                    <li>• Skip manual copy-paste between platforms</li>
                    <li>• Track campaign performance in one place</li>
                    <li>• Manage budgets and targeting from ZAP</li>
                  </ul>
                </div>

                <Button
                  onClick={handleConnect}
                  disabled={!oauthUrl?.url}
                  className="w-full sm:w-auto"
                >
                  {!oauthUrl?.url && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Connect Meta Ads Manager
                </Button>

                <p className="text-xs text-muted-foreground">
                  You'll be redirected to Facebook to authorize ZAP. We only request permissions
                  to manage your ads - we never post to your personal timeline.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* GoHighLevel Integration (Coming Soon) */}
        <Card className="opacity-60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-500 to-purple-600" />
              GoHighLevel
              <span className="ml-2 text-xs font-normal text-muted-foreground">(Coming Soon)</span>
            </CardTitle>
            <CardDescription className="mt-2">
              Send landing page leads directly to your GoHighLevel CRM
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Webhook integration coming soon. Automatically sync form submissions to GoHighLevel
              workflows and trigger SMS/email sequences.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
