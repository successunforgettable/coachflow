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
    // Social proof fields
    totalCustomers: "",
    averageRating: "",
    totalReviews: "",
    testimonial1Name: "",
    testimonial1Title: "",
    testimonial1Quote: "",
    testimonial2Name: "",
    testimonial2Title: "",
    testimonial2Quote: "",
    testimonial3Name: "",
    testimonial3Title: "",
    testimonial3Quote: "",
    pressFeatures: "",
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
        // Social proof fields
        totalCustomers: service.totalCustomers?.toString() || "",
        averageRating: service.averageRating?.toString() || "",
        totalReviews: service.totalReviews?.toString() || "",
        testimonial1Name: service.testimonial1Name || "",
        testimonial1Title: service.testimonial1Title || "",
        testimonial1Quote: service.testimonial1Quote || "",
        testimonial2Name: service.testimonial2Name || "",
        testimonial2Title: service.testimonial2Title || "",
        testimonial2Quote: service.testimonial2Quote || "",
        testimonial3Name: service.testimonial3Name || "",
        testimonial3Title: service.testimonial3Title || "",
        testimonial3Quote: service.testimonial3Quote || "",
        pressFeatures: service.pressFeatures || "",
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
      // Social proof fields
      totalCustomers: formData.totalCustomers ? parseInt(formData.totalCustomers) : undefined,
      averageRating: formData.averageRating ? parseFloat(formData.averageRating) : undefined,
      totalReviews: formData.totalReviews ? parseInt(formData.totalReviews) : undefined,
      testimonial1Name: formData.testimonial1Name || undefined,
      testimonial1Title: formData.testimonial1Title || undefined,
      testimonial1Quote: formData.testimonial1Quote || undefined,
      testimonial2Name: formData.testimonial2Name || undefined,
      testimonial2Title: formData.testimonial2Title || undefined,
      testimonial2Quote: formData.testimonial2Quote || undefined,
      testimonial3Name: formData.testimonial3Name || undefined,
      testimonial3Title: formData.testimonial3Title || undefined,
      testimonial3Quote: formData.testimonial3Quote || undefined,
      pressFeatures: formData.pressFeatures || undefined,
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

              {/* Social Proof Section */}
              <div className="border-t pt-6 mt-6">
                <h3 className="text-lg font-semibold mb-4">Social Proof (Optional)</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Add real social proof to eliminate fabricated statistics in generated content. Leave empty for launch-safe alternatives.
                </p>

                <div className="space-y-6">
                  {/* Customer Stats */}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="totalCustomers">Total Customers</Label>
                      <Input
                        id="totalCustomers"
                        type="number"
                        placeholder="e.g., 500"
                        value={formData.totalCustomers}
                        onChange={(e) => setFormData({ ...formData, totalCustomers: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="averageRating">Average Rating</Label>
                      <Input
                        id="averageRating"
                        type="number"
                        step="0.1"
                        min="0"
                        max="5"
                        placeholder="e.g., 4.8"
                        value={formData.averageRating}
                        onChange={(e) => setFormData({ ...formData, averageRating: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="totalReviews">Total Reviews</Label>
                      <Input
                        id="totalReviews"
                        type="number"
                        placeholder="e.g., 127"
                        value={formData.totalReviews}
                        onChange={(e) => setFormData({ ...formData, totalReviews: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Testimonial 1 */}
                  <div className="border-l-2 border-primary/30 pl-4">
                    <h4 className="text-sm font-semibold mb-3">Testimonial 1</h4>
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <Label htmlFor="testimonial1Name">Name</Label>
                        <Input
                          id="testimonial1Name"
                          placeholder="e.g., Sarah Johnson"
                          value={formData.testimonial1Name}
                          onChange={(e) => setFormData({ ...formData, testimonial1Name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="testimonial1Title">Title/Role</Label>
                        <Input
                          id="testimonial1Title"
                          placeholder="e.g., CEO, TechCorp"
                          value={formData.testimonial1Title}
                          onChange={(e) => setFormData({ ...formData, testimonial1Title: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="testimonial1Quote">Quote</Label>
                      <Textarea
                        id="testimonial1Quote"
                        placeholder="What did they say about your service?"
                        value={formData.testimonial1Quote}
                        onChange={(e) => setFormData({ ...formData, testimonial1Quote: e.target.value })}
                        rows={3}
                      />
                    </div>
                  </div>

                  {/* Testimonial 2 */}
                  <div className="border-l-2 border-primary/30 pl-4">
                    <h4 className="text-sm font-semibold mb-3">Testimonial 2</h4>
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <Label htmlFor="testimonial2Name">Name</Label>
                        <Input
                          id="testimonial2Name"
                          placeholder="e.g., Michael Chen"
                          value={formData.testimonial2Name}
                          onChange={(e) => setFormData({ ...formData, testimonial2Name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="testimonial2Title">Title/Role</Label>
                        <Input
                          id="testimonial2Title"
                          placeholder="e.g., Marketing Director"
                          value={formData.testimonial2Title}
                          onChange={(e) => setFormData({ ...formData, testimonial2Title: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="testimonial2Quote">Quote</Label>
                      <Textarea
                        id="testimonial2Quote"
                        placeholder="What did they say about your service?"
                        value={formData.testimonial2Quote}
                        onChange={(e) => setFormData({ ...formData, testimonial2Quote: e.target.value })}
                        rows={3}
                      />
                    </div>
                  </div>

                  {/* Testimonial 3 */}
                  <div className="border-l-2 border-primary/30 pl-4">
                    <h4 className="text-sm font-semibold mb-3">Testimonial 3</h4>
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <Label htmlFor="testimonial3Name">Name</Label>
                        <Input
                          id="testimonial3Name"
                          placeholder="e.g., Emily Rodriguez"
                          value={formData.testimonial3Name}
                          onChange={(e) => setFormData({ ...formData, testimonial3Name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="testimonial3Title">Title/Role</Label>
                        <Input
                          id="testimonial3Title"
                          placeholder="e.g., Founder, StartupXYZ"
                          value={formData.testimonial3Title}
                          onChange={(e) => setFormData({ ...formData, testimonial3Title: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="testimonial3Quote">Quote</Label>
                      <Textarea
                        id="testimonial3Quote"
                        placeholder="What did they say about your service?"
                        value={formData.testimonial3Quote}
                        onChange={(e) => setFormData({ ...formData, testimonial3Quote: e.target.value })}
                        rows={3}
                      />
                    </div>
                  </div>

                  {/* Press Features */}
                  <div>
                    <Label htmlFor="pressFeatures">Press Features</Label>
                    <Textarea
                      id="pressFeatures"
                      placeholder="e.g., Featured in Forbes, TechCrunch, Entrepreneur Magazine"
                      value={formData.pressFeatures}
                      onChange={(e) => setFormData({ ...formData, pressFeatures: e.target.value })}
                      rows={2}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Comma-separated list of real press mentions only
                    </p>
                  </div>
                </div>
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
