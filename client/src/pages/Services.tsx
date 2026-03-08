import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { useState, useEffect } from "react";
import { Loader2, Plus, Trash2, Edit } from "lucide-react";
import { useLocation } from "wouter";
import PageHeader from "@/components/PageHeader";

export default function Services() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    category: "coaching" as "coaching" | "speaking" | "consulting",
    description: "",
    targetCustomer: "",
    mainBenefit: "",
    price: "",
  });

  // Pre-fill service name from landing page hero input
  useEffect(() => {
    const stored = sessionStorage.getItem("zap_programme_name");
    if (stored) {
      setFormData(prev => ({ ...prev, name: stored }));
      setShowCreateForm(true);
      sessionStorage.removeItem("zap_programme_name");
    }
  }, []);

  // tRPC queries and mutations
  const { data: services, isLoading, refetch } = trpc.services.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const createMutation = trpc.services.create.useMutation({
    onSuccess: () => {
      refetch();
      setShowCreateForm(false);
      setFormData({
        name: "",
        category: "coaching",
        description: "",
        targetCustomer: "",
        mainBenefit: "",
        price: "",
      });
    },
  });

  const deleteMutation = trpc.services.delete.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  // Redirect to login if not authenticated
  if (!authLoading && !isAuthenticated) {
    window.location.href = "/";
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      ...formData,
      price: formData.price ? parseFloat(formData.price) : undefined,
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this service?")) {
      deleteMutation.mutate({ id });
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <PageHeader
          title="Services"
          description="Manage your coaching, speaking, and consulting services"
          backTo="/dashboard"
          action={
            <Button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {showCreateForm ? "Cancel" : "New Service"}
            </Button>
          }
        />

        {/* Create Form */}
        {showCreateForm && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Create New Service</CardTitle>
              <CardDescription>
                Simplified setup - just 6 fields (vs Industry 15!)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Service Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Executive Coaching Program"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">Category *</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value: "coaching" | "speaking" | "consulting") =>
                        setFormData({ ...formData, category: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="coaching">Coaching</SelectItem>
                        <SelectItem value="speaking">Speaking</SelectItem>
                        <SelectItem value="consulting">Consulting</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="What is this service about?"
                    rows={3}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="targetCustomer">Target Customer * (max 500 chars)</Label>
                  <Textarea
                    id="targetCustomer"
                    value={formData.targetCustomer}
                    onChange={(e) => setFormData({ ...formData, targetCustomer: e.target.value })}
                    placeholder="Who is this service for? e.g., C-suite executives in tech companies"
                    rows={2}
                    maxLength={500}
                    required
                  />
                  <p className="text-sm text-gray-500">{formData.targetCustomer.length}/500</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mainBenefit">Main Benefit * (max 500 chars)</Label>
                  <Textarea
                    id="mainBenefit"
                    value={formData.mainBenefit}
                    onChange={(e) => setFormData({ ...formData, mainBenefit: e.target.value })}
                    placeholder="What's the #1 benefit? e.g., Double your leadership effectiveness in 90 days"
                    rows={2}
                    maxLength={500}
                    required
                  />
                  <p className="text-sm text-gray-500">{formData.mainBenefit.length}/500</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="price">Price (optional)</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="e.g., 5000"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="flex items-center gap-2"
                  >
                    {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    Create Service
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateForm(false)}
                  >
                    Cancel
                  </Button>
                </div>

                {createMutation.isError && (
                  <p className="text-red-600 text-sm">
                    Error: {createMutation.error.message}
                  </p>
                )}
              </form>
            </CardContent>
          </Card>
        )}

        {/* Services List */}
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : services && services.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service) => (
              <Card key={service.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-xl">{service.name}</CardTitle>
                      <CardDescription className="mt-1">
        <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-primary/20 text-primary">
                          {service.category}
                        </span>
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(service.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Description:</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {service.description}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Target Customer:</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {service.targetCustomer}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Main Benefit:</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {service.mainBenefit}
                    </p>
                  </div>
                  {service.price && (
                    <div>
                      <p className="text-sm font-medium text-foreground">Price:</p>
                      <p className="text-lg font-bold text-primary">
                        ${parseFloat(service.price).toLocaleString()}
                      </p>
                    </div>
                  )}
                  <div className="pt-2">
                    <Button
                      variant="outline"
                      className="w-full flex items-center justify-center gap-2"
                      onClick={() => setLocation(`/services/${service.id}`)}
                    >
                      <Edit className="w-4 h-4" />
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">
                No services yet. Create your first service to get started!
              </p>
              <Button onClick={() => setShowCreateForm(true)} className="flex items-center gap-2 mx-auto">
                <Plus className="w-4 h-4" />
                Create First Service
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
