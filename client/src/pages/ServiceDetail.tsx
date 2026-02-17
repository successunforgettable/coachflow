import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import PageHeader from "@/components/PageHeader";
import { Loader2, Save, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useRoute, useLocation } from "wouter";

export default function ServiceDetail() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, params] = useRoute("/services/:id");
  const [, setLocation] = useLocation();
  const serviceId = params?.id ? parseInt(params.id) : null;

  const [formData, setFormData] = useState({
    name: "",
    category: "coaching" as "coaching" | "speaking" | "consulting",
    description: "",
    targetCustomer: "",
    mainBenefit: "",
    price: "",
  });

  // Fetch service details
  const { data: services, isLoading } = trpc.services.list.useQuery(undefined, {
    enabled: isAuthenticated && serviceId !== null,
  });

  const service = services?.find((s) => s.id === serviceId);

  // Update mutation
  const updateMutation = trpc.services.update.useMutation({
    onSuccess: () => {
      toast.success("Service updated successfully!");
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Delete mutation
  const deleteMutation = trpc.services.delete.useMutation({
    onSuccess: () => {
      toast.success("Service deleted successfully!");
      setLocation("/services");
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Load service data into form
  useEffect(() => {
    if (service) {
      setFormData({
        name: service.name,
        category: service.category,
        description: service.description || "",
        targetCustomer: service.targetCustomer || "",
        mainBenefit: service.mainBenefit || "",
        price: service.price || "",
      });
    }
  }, [service]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  if (!service) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-4xl mx-auto">
          <PageHeader title="Service Not Found" description="The service you're looking for doesn't exist" backTo="/services" />
          <Card className="mt-8">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">Service ID {serviceId} not found</p>
              <Button onClick={() => setLocation("/services")}>Back to Services</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceId) return;

    updateMutation.mutate({
      id: serviceId,
      name: formData.name,
      category: formData.category,
      description: formData.description,
      targetCustomer: formData.targetCustomer,
      mainBenefit: formData.mainBenefit,
      price: formData.price ? parseFloat(formData.price) : undefined,
    });
  };

  const handleDelete = () => {
    if (!serviceId) return;
    if (confirm("Are you sure you want to delete this service? This action cannot be undone.")) {
      deleteMutation.mutate({ id: serviceId });
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <PageHeader
          title={`Edit Service: ${service.name}`}
          description="Update your service details"
          backTo="/services"
          action={
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Service
                </>
              )}
            </Button>
          }
        />

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Service Details</CardTitle>
            <CardDescription>Update your service information</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="name">Service Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Leadership Coaching"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="category">Category *</Label>
                <select
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as "coaching" | "speaking" | "consulting" })}
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="coaching">Coaching</option>
                  <option value="speaking">Speaking</option>
                  <option value="consulting">Consulting</option>
                </select>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe your service..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                />
              </div>

              <div>
                <Label htmlFor="targetCustomer">Target Customer</Label>
                <Input
                  id="targetCustomer"
                  placeholder="e.g., Mid-level managers"
                  value={formData.targetCustomer}
                  onChange={(e) => setFormData({ ...formData, targetCustomer: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="mainBenefit">Main Benefit</Label>
                <Textarea
                  id="mainBenefit"
                  placeholder="What's the main benefit of this service?"
                  value={formData.mainBenefit}
                  onChange={(e) => setFormData({ ...formData, mainBenefit: e.target.value })}
                  rows={3}
                  required
                />
              </div>

              <div>
                <Label htmlFor="price">Price</Label>
                <Input
                  id="price"
                  placeholder="e.g., $5,000"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                />
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={updateMutation.isPending} className="flex-1">
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={() => setLocation("/services")}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
