import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import PageHeader from "@/components/PageHeader";
import { Loader2, Sparkles, Edit, Save, X } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function SourceOfTruth() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);

  // Form state for generation
  const [generatorForm, setGeneratorForm] = useState({
    programName: "",
    coreOffer: "",
    targetAudience: "",
    mainPainPoint: "",
    priceRange: "",
  });

  // Form state for editing
  const [editForm, setEditForm] = useState({
    programName: "",
    coreOffer: "",
    targetAudience: "",
    mainPainPoint: "",
    priceRange: "",
    description: "",
    targetCustomer: "",
    mainBenefits: "",
    painPoints: "",
    uniqueValue: "",
    idealCustomerAvatar: "",
  });

  const { data: sourceOfTruth, refetch } = trpc.sourceOfTruth.get.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const generateMutation = trpc.sourceOfTruth.generate.useMutation({
    onSuccess: () => {
      toast.success("Source of Truth generated!");
      setShowGenerator(false);
      refetch();
    },
    onError: (error) => toast.error(`Error: ${error.message}`),
  });

  const updateMutation = trpc.sourceOfTruth.update.useMutation({
    onSuccess: () => {
      toast.success("Source of Truth updated!");
      setIsEditing(false);
      refetch();
    },
    onError: (error) => toast.error(`Error: ${error.message}`),
  });

  // Load source of truth into edit form
  useEffect(() => {
    if (sourceOfTruth) {
      setEditForm({
        programName: sourceOfTruth.programName || "",
        coreOffer: sourceOfTruth.coreOffer || "",
        targetAudience: sourceOfTruth.targetAudience || "",
        mainPainPoint: sourceOfTruth.mainPainPoint || "",
        priceRange: sourceOfTruth.priceRange || "",
        description: sourceOfTruth.description || "",
        targetCustomer: sourceOfTruth.targetCustomer || "",
        mainBenefits: sourceOfTruth.mainBenefits || "",
        painPoints: sourceOfTruth.painPoints || "",
        uniqueValue: sourceOfTruth.uniqueValue || "",
        idealCustomerAvatar: sourceOfTruth.idealCustomerAvatar || "",
      });
    }
  }, [sourceOfTruth]);

  if (authLoading) {
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

  const handleGenerate = () => {
    generateMutation.mutate(generatorForm);
  };

  const handleUpdate = () => {
    updateMutation.mutate(editForm);
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-5xl mx-auto">
        <PageHeader
          title="Source of Truth"
          description="Your AI-generated comprehensive service profile - the foundation for all your marketing"
          backTo="/dashboard"
          action={
            sourceOfTruth && !isEditing ? (
              <Button onClick={() => setIsEditing(true)}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
            ) : isEditing ? (
              <div className="flex gap-2">
                <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
                  ) : (
                    <><Save className="w-4 h-4 mr-2" />Save</>
                  )}
                </Button>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              </div>
            ) : null
          }
        />

        {!sourceOfTruth && !showGenerator && (
          <Card>
            <CardContent className="py-12 text-center">
              <Sparkles className="w-16 h-16 mx-auto mb-4 text-primary" />
              <h2 className="text-2xl font-bold text-foreground mb-2">Create Your Source of Truth</h2>
              <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                Answer 4 simple questions and let AI generate a comprehensive service profile that will power all your
                marketing assets. This becomes your single source of truth for ICPs, ad copy, email sequences, and more.
              </p>
              <Button onClick={() => setShowGenerator(true)} size="lg">
                <Sparkles className="w-5 h-5 mr-2" />
                Generate Source of Truth
              </Button>
            </CardContent>
          </Card>
        )}

        {showGenerator && (
          <Card>
            <CardHeader>
              <CardTitle>Generate Your Source of Truth</CardTitle>
              <CardDescription>Fill in these 4 fields and AI will generate a complete profile</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label>Program Name *</Label>
                <Input
                  placeholder="e.g., The Incredible You Coach Training"
                  value={generatorForm.programName}
                  onChange={(e) => setGeneratorForm({ ...generatorForm, programName: e.target.value })}
                />
              </div>
              <div>
                <Label>Core Offer (What transformation do you provide?) *</Label>
                <Textarea
                  placeholder="e.g., Transform from stuck to unstoppable in 3 months..."
                  value={generatorForm.coreOffer}
                  onChange={(e) => setGeneratorForm({ ...generatorForm, coreOffer: e.target.value })}
                  rows={3}
                />
              </div>
              <div>
                <Label>Target Audience (Who do you help?) *</Label>
                <Textarea
                  placeholder="e.g., Age 25-55, working adults trapped in unfulfilling jobs..."
                  value={generatorForm.targetAudience}
                  onChange={(e) => setGeneratorForm({ ...generatorForm, targetAudience: e.target.value })}
                  rows={3}
                />
              </div>
              <div>
                <Label>Main Pain Point (What problem do they face?) *</Label>
                <Textarea
                  placeholder="e.g., They wake up dreading another day at their soul-crushing job..."
                  value={generatorForm.mainPainPoint}
                  onChange={(e) => setGeneratorForm({ ...generatorForm, mainPainPoint: e.target.value })}
                  rows={3}
                />
              </div>
              <div>
                <Label>Price Range (Optional)</Label>
                <Input
                  placeholder="e.g., $5,000 - $10,000"
                  value={generatorForm.priceRange}
                  onChange={(e) => setGeneratorForm({ ...generatorForm, priceRange: e.target.value })}
                />
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={handleGenerate}
                  disabled={
                    generateMutation.isPending ||
                    !generatorForm.programName ||
                    !generatorForm.coreOffer ||
                    !generatorForm.targetAudience ||
                    !generatorForm.mainPainPoint
                  }
                  className="flex-1"
                >
                  {generateMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-2" />Generate with AI</>
                  )}
                </Button>
                <Button variant="outline" onClick={() => setShowGenerator(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {sourceOfTruth && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Program Name</Label>
                  {isEditing ? (
                    <Input
                      value={editForm.programName}
                      onChange={(e) => setEditForm({ ...editForm, programName: e.target.value })}
                    />
                  ) : (
                    <p className="text-foreground mt-1">{sourceOfTruth.programName}</p>
                  )}
                </div>
                <div>
                  <Label>Core Offer</Label>
                  {isEditing ? (
                    <Textarea
                      value={editForm.coreOffer}
                      onChange={(e) => setEditForm({ ...editForm, coreOffer: e.target.value })}
                      rows={3}
                    />
                  ) : (
                    <p className="text-foreground mt-1 whitespace-pre-wrap">{sourceOfTruth.coreOffer}</p>
                  )}
                </div>
                <div>
                  <Label>Price Range</Label>
                  {isEditing ? (
                    <Input
                      value={editForm.priceRange}
                      onChange={(e) => setEditForm({ ...editForm, priceRange: e.target.value })}
                    />
                  ) : (
                    <p className="text-foreground mt-1">{sourceOfTruth.priceRange || "Not specified"}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>AI-Generated Profile</CardTitle>
                <CardDescription>Comprehensive service profile generated by AI (editable)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label>Service Description</Label>
                  {isEditing ? (
                    <Textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      rows={4}
                    />
                  ) : (
                    <p className="text-foreground mt-1 whitespace-pre-wrap">{sourceOfTruth.description}</p>
                  )}
                </div>
                <div>
                  <Label>Target Customer Profile</Label>
                  {isEditing ? (
                    <Textarea
                      value={editForm.targetCustomer}
                      onChange={(e) => setEditForm({ ...editForm, targetCustomer: e.target.value })}
                      rows={4}
                    />
                  ) : (
                    <p className="text-foreground mt-1 whitespace-pre-wrap">{sourceOfTruth.targetCustomer}</p>
                  )}
                </div>
                <div>
                  <Label>Main Benefits</Label>
                  {isEditing ? (
                    <Textarea
                      value={editForm.mainBenefits}
                      onChange={(e) => setEditForm({ ...editForm, mainBenefits: e.target.value })}
                      rows={4}
                    />
                  ) : (
                    <p className="text-foreground mt-1 whitespace-pre-wrap">{sourceOfTruth.mainBenefits}</p>
                  )}
                </div>
                <div>
                  <Label>Pain Points Solved</Label>
                  {isEditing ? (
                    <Textarea
                      value={editForm.painPoints}
                      onChange={(e) => setEditForm({ ...editForm, painPoints: e.target.value })}
                      rows={4}
                    />
                  ) : (
                    <p className="text-foreground mt-1 whitespace-pre-wrap">{sourceOfTruth.painPoints}</p>
                  )}
                </div>
                <div>
                  <Label>Unique Value Proposition</Label>
                  {isEditing ? (
                    <Textarea
                      value={editForm.uniqueValue}
                      onChange={(e) => setEditForm({ ...editForm, uniqueValue: e.target.value })}
                      rows={3}
                    />
                  ) : (
                    <p className="text-foreground mt-1 whitespace-pre-wrap">{sourceOfTruth.uniqueValue}</p>
                  )}
                </div>
                <div>
                  <Label>Ideal Customer Avatar</Label>
                  {isEditing ? (
                    <Textarea
                      value={editForm.idealCustomerAvatar}
                      onChange={(e) => setEditForm({ ...editForm, idealCustomerAvatar: e.target.value })}
                      rows={4}
                    />
                  ) : (
                    <p className="text-foreground mt-1 whitespace-pre-wrap">{sourceOfTruth.idealCustomerAvatar}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
