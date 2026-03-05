import { useAuth } from "@/_core/hooks/useAuth";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { ArrowLeft, Loader2, Plus, Trash2, FolderOpen } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function Campaigns() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [campaignType, setCampaignType] = useState<"webinar" | "challenge" | "course_launch" | "product_launch">("webinar");

  const { data: services } = trpc.services.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: campaigns, refetch } = trpc.campaigns.list.useQuery(undefined, { enabled: isAuthenticated });

  const createMutation = trpc.campaigns.create.useMutation({
    onSuccess: () => {
      toast.success("Campaign created!");
      setIsCreateOpen(false);
      setName("");
      setServiceId(null);
      refetch();
    },
    onError: (error) => toast.error(`Error: ${error.message}`),
  });

  const deleteMutation = trpc.campaigns.delete.useMutation({
    onSuccess: () => {
      toast.success("Campaign deleted");
      refetch();
    },
  });

  const updateStatusMutation = trpc.campaigns.update.useMutation({
    onSuccess: () => {
      toast.success("Campaign status updated");
      refetch();
    },
  });

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!isAuthenticated) {
    window.location.href = "/";
    return null;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft": return "bg-gray-500/10 text-gray-500 border-gray-500/20";
      case "active": return "bg-green-500/10 text-green-500 border-green-500/20";
      case "paused": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "completed": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      default: return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader 
        title="Campaigns" 
        description="Organize and manage your marketing campaigns"
        backTo="/dashboard"
      />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/dashboard"><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Campaigns</h1>
              <p className="text-muted-foreground">Organize your marketing assets into complete campaigns</p>
            </div>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />New Campaign</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Campaign</DialogTitle>
                <DialogDescription>Organize all your generated assets into a cohesive marketing campaign</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Campaign Name</label>
                  <Input placeholder="e.g., Q1 Webinar Funnel" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Service (Optional)</label>
                  <Select value={serviceId?.toString() || ""} onValueChange={(v) => setServiceId(v ? parseInt(v) : null)}>
                    <SelectTrigger><SelectValue placeholder="Select a service..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {services?.map((s) => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Campaign Type</label>
                  <Select value={campaignType} onValueChange={(v: any) => setCampaignType(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="webinar">Webinar Funnel</SelectItem>
                      <SelectItem value="challenge">Challenge/Workshop</SelectItem>
                      <SelectItem value="course_launch">Course Launch</SelectItem>
                      <SelectItem value="product_launch">Product Launch</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => createMutation.mutate({ name, serviceId: serviceId || undefined, campaignType })} disabled={createMutation.isPending || !name} className="w-full">
                  {createMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</> : "Create Campaign"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {!campaigns || campaigns.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FolderOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-semibold text-foreground mb-2">No campaigns yet</p>
              <p className="text-muted-foreground mb-4">Create your first campaign to organize your marketing assets</p>
              <Button onClick={() => setIsCreateOpen(true)}><Plus className="w-4 h-4 mr-2" />Create First Campaign</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaigns.map((campaign) => (
              <Card key={campaign.id} className="hover:border-primary transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-2">{campaign.name}</CardTitle>
                      <CardDescription className="capitalize">{campaign.campaignType?.replace("_", " ")}</CardDescription>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate({ id: campaign.id })}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(campaign.status)}`}>
                    {campaign.status.toUpperCase()}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="text-sm text-muted-foreground">
                      Created: {new Date(campaign.createdAt).toLocaleDateString()}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => updateStatusMutation.mutate({ id: campaign.id, status: "active" })} disabled={campaign.status === "active"}>
                        Activate
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => updateStatusMutation.mutate({ id: campaign.id, status: "paused" })} disabled={campaign.status === "paused"}>
                        Pause
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => updateStatusMutation.mutate({ id: campaign.id, status: "completed" })} disabled={campaign.status === "completed"}>
                        Complete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
