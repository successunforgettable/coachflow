import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Edit, Plus, Trash2, Shield, Calendar, RefreshCw, Download, Upload, History, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";

type BannedPhrase = {
  id: number;
  phrase: string;
  category: "critical" | "warning";
  description: string | null;
  suggestion: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type FormData = {
  phrase: string;
  category: "critical" | "warning";
  description: string;
  suggestion: string;
  active: boolean;
};

export default function ComplianceAdmin() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const utils = trpc.useUtils();

  // Check admin access
  if (!user || user.role !== "admin") {
    navigate("/");
    return null;
  }

  // State
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [selectedPhrase, setSelectedPhrase] = useState<BannedPhrase | null>(null);
  const [csvContent, setCsvContent] = useState("");
  const [importMode, setImportMode] = useState<"replace" | "append">("append");
  const [formData, setFormData] = useState<FormData>({
    phrase: "",
    category: "critical",
    description: "",
    suggestion: "",
    active: true,
  });

  // Queries
  const { data: phrases, isLoading: phrasesLoading } = trpc.compliance.listPhrases.useQuery();
  const { data: version } = trpc.compliance.getVersion.useQuery();
  const { data: history, isLoading: historyLoading } = trpc.compliance.getHistory.useQuery({ limit: 50 });

  // Queries for CSV
  const { refetch: exportCSV } = trpc.compliance.exportCSV.useQuery(undefined, {
    enabled: false,
  });

  // Mutations
  const importCSV = trpc.compliance.importCSV.useMutation({
    onSuccess: (data) => {
      utils.compliance.listPhrases.invalidate();
      setIsImportDialogOpen(false);
      setCsvContent("");
      toast({
        title: "Import successful",
        description: `Imported ${data.imported} phrases (${data.mode} mode)`,
      });
    },
    onError: (error) => {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addPhrase = trpc.compliance.addPhrase.useMutation({
    onSuccess: () => {
      utils.compliance.listPhrases.invalidate();
      setIsAddDialogOpen(false);
      resetForm();
      toast({
        title: "Phrase added",
        description: "Banned phrase has been added successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updatePhrase = trpc.compliance.updatePhrase.useMutation({
    onSuccess: () => {
      utils.compliance.listPhrases.invalidate();
      setIsEditDialogOpen(false);
      setSelectedPhrase(null);
      resetForm();
      toast({
        title: "Phrase updated",
        description: "Banned phrase has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deletePhrase = trpc.compliance.deletePhrase.useMutation({
    onSuccess: () => {
      utils.compliance.listPhrases.invalidate();
      setIsDeleteDialogOpen(false);
      setSelectedPhrase(null);
      toast({
        title: "Phrase deleted",
        description: "Banned phrase has been deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateVersion = trpc.compliance.updateVersion.useMutation({
    onSuccess: (data) => {
      utils.compliance.getVersion.invalidate();
      toast({
        title: "Version updated",
        description: `Compliance version updated to ${data.version}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handlers
  const resetForm = () => {
    setFormData({
      phrase: "",
      category: "critical",
      description: "",
      suggestion: "",
      active: true,
    });
  };

  const handleAdd = () => {
    setIsAddDialogOpen(true);
    resetForm();
  };

  const handleEdit = (phrase: BannedPhrase) => {
    setSelectedPhrase(phrase);
    setFormData({
      phrase: phrase.phrase,
      category: phrase.category,
      description: phrase.description || "",
      suggestion: phrase.suggestion || "",
      active: phrase.active,
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (phrase: BannedPhrase) => {
    setSelectedPhrase(phrase);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmitAdd = () => {
    addPhrase.mutate({
      phrase: formData.phrase,
      category: formData.category,
      description: formData.description || undefined,
      suggestion: formData.suggestion || undefined,
    });
  };

  const handleSubmitEdit = () => {
    if (!selectedPhrase) return;
    updatePhrase.mutate({
      id: selectedPhrase.id,
      phrase: formData.phrase,
      category: formData.category,
      description: formData.description || undefined,
      suggestion: formData.suggestion || undefined,
      active: formData.active,
    });
  };

  const handleConfirmDelete = () => {
    if (!selectedPhrase) return;
    deletePhrase.mutate({ id: selectedPhrase.id });
  };

  const handleUpdateVersion = () => {
    updateVersion.mutate({
      notes: `Manual version update on ${new Date().toLocaleDateString()}`,
    });
  };

  const handleExportCSV = async () => {
    try {
      const result = await exportCSV();
      if (result.data?.csv) {
        // Create download link
        const blob = new Blob([result.data.csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `banned-phrases-${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        toast({
          title: "Export successful",
          description: "CSV file has been downloaded",
        });
      }
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Failed to export CSV",
        variant: "destructive",
      });
    }
  };

  const handleImportCSV = () => {
    if (!csvContent.trim()) {
      toast({
        title: "Error",
        description: "Please paste CSV content",
        variant: "destructive",
      });
      return;
    }
    importCSV.mutate({ csv: csvContent, mode: importMode });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setCsvContent(content);
      };
      reader.readAsText(file);
    }
  };

  // Stats
  const criticalCount = phrases?.filter((p) => p.category === "critical" && p.active).length || 0;
  const warningCount = phrases?.filter((p) => p.category === "warning" && p.active).length || 0;
  const inactiveCount = phrases?.filter((p) => !p.active).length || 0;

  return (
    <div style={{ minHeight: "100vh", background: "#F5F1EA", color: "#1A1624", padding: "32px" }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">Meta Compliance Admin</h1>
              <p className="text-gray-400">
                Manage banned phrases and compliance rules for Meta advertising
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => navigate("/admin/compliance/analytics")}
                variant="outline"
                className="bg-transparent border-gray-200 text-[#1A1624] hover:bg-gray-100 hover:border-[#8B5CF6]"
              >
                View Analytics
              </Button>
              <Button
                onClick={() => navigate("/")}
                variant="outline"
                className="bg-transparent border-gray-200 text-[#1A1624] hover:bg-gray-100 hover:border-[#8B5CF6]"
              >
                Back to Dashboard
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-white border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-400">Critical Phrases</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-500">{criticalCount}</div>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-400">Warning Phrases</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-500">{warningCount}</div>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-400">Inactive Phrases</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-500">{inactiveCount}</div>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-400">Current Version</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-[#8B5CF6]">{version?.version || "v1.0"}</div>
            </CardContent>
          </Card>
        </div>

        {/* Version Info */}
        {version && (
          <Card className="bg-white border-gray-200 mb-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-[#8B5CF6]" />
                    Compliance Version Information
                  </CardTitle>
                  <CardDescription className="text-gray-400 mt-2">
                    Track quarterly Meta policy updates and review cycles
                  </CardDescription>
                </div>
                <Button
                  onClick={handleUpdateVersion}
                  disabled={updateVersion.isPending}
                  className="bg-gradient-to-br from-[#8B5CF6] to-[#A78BFA] hover:from-[#7C3AED] hover:to-[#8B5CF6]"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Update Version
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-400">Last Updated</p>
                    <p className="font-semibold">{version.lastUpdated.toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-amber-500" />
                  <div>
                    <p className="text-sm text-gray-400">Next Review Due</p>
                    <p className="font-semibold">{version.nextReviewDue.toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-[#8B5CF6]" />
                  <div>
                    <p className="text-sm text-gray-400">Notes</p>
                    <p className="font-semibold text-sm">{version.notes || "No notes"}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Phrases Table */}
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Banned Phrases</CardTitle>
                <CardDescription className="text-gray-400 mt-2">
                  Manage phrases that trigger compliance warnings in generated ad copy
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleExportCSV}
                  variant="outline"
                  className="bg-transparent border-gray-200 text-[#1A1624] hover:bg-gray-100 hover:border-[#8B5CF6]"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
                <Button
                  onClick={() => setIsImportDialogOpen(true)}
                  variant="outline"
                  className="bg-transparent border-gray-200 text-[#1A1624] hover:bg-gray-100 hover:border-[#8B5CF6]"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Import CSV
                </Button>
                <Button
                  onClick={handleAdd}
                  className="bg-gradient-to-br from-[#8B5CF6] to-[#A78BFA] hover:from-[#7C3AED] hover:to-[#8B5CF6]"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Phrase
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {phrasesLoading ? (
              <div className="text-center py-8 text-gray-400">Loading phrases...</div>
            ) : !phrases || phrases.length === 0 ? (
              <div className="text-center py-8 text-gray-400">No banned phrases found</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-200 hover:bg-gray-100">
                    <TableHead className="text-gray-400">Phrase</TableHead>
                    <TableHead className="text-gray-400">Category</TableHead>
                    <TableHead className="text-gray-400">Description</TableHead>
                    <TableHead className="text-gray-400">Status</TableHead>
                    <TableHead className="text-gray-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {phrases.map((phrase) => (
                    <TableRow key={phrase.id} className="border-gray-200 hover:bg-gray-100">
                      <TableCell className="font-mono text-sm">{phrase.phrase}</TableCell>
                      <TableCell>
                        <Badge
                          variant={phrase.category === "critical" ? "destructive" : "default"}
                          className={
                            phrase.category === "critical"
                              ? "bg-red-500/10 text-red-500 border-red-500/20"
                              : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                          }
                        >
                          {phrase.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-400 max-w-md truncate">
                        {phrase.description || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={phrase.active ? "default" : "secondary"}
                          className={
                            phrase.active
                              ? "bg-green-500/10 text-green-500 border-green-500/20"
                              : "bg-gray-500/10 text-gray-500 border-gray-500/20"
                          }
                        >
                          {phrase.active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            onClick={() => handleEdit(phrase)}
                            variant="ghost"
                            size="sm"
                            className="text-[#8B5CF6] hover:text-[#A78BFA] hover:bg-[#8B5CF6]/10"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={() => handleDelete(phrase)}
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Compliance History */}
        <Card className="bg-white border-gray-200 mt-8">
          <CardHeader>
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-[#8B5CF6]" />
              <CardTitle>Compliance History (Audit Log)</CardTitle>
            </div>
            <CardDescription className="text-gray-400 mt-2">
              Track all changes made to compliance rules and phrases
            </CardDescription>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="text-center py-8 text-gray-400">Loading history...</div>
            ) : !history || history.length === 0 ? (
              <div className="text-center py-8 text-gray-400">No history records found</div>
            ) : (
              <div className="space-y-4">
                {history.slice().reverse().map((record) => (
                  <div
                    key={record.id}
                    className="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:border-[#8B5CF6]/30 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge
                            variant="outline"
                            className={
                              record.action === "add"
                                ? "bg-green-500/10 text-green-500 border-green-500/20"
                                : record.action === "update"
                                ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                                : record.action === "delete"
                                ? "bg-red-500/10 text-red-500 border-red-500/20"
                                : record.action === "import"
                                ? "bg-purple-500/10 text-purple-500 border-purple-500/20"
                                : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                            }
                          >
                            {record.action.toUpperCase()}
                          </Badge>
                          <span className="text-sm text-gray-400">
                            by <span className="text-[#1A1624] font-medium">{record.adminUserName}</span>
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-1">{record.details}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Clock className="w-3 h-3" />
                          {new Date(record.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="bg-white border-gray-200 text-[#1A1624]">
          <DialogHeader>
            <DialogTitle>Add Banned Phrase</DialogTitle>
            <DialogDescription className="text-gray-400">
              Add a new phrase to the Meta compliance checker
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="phrase">Phrase</Label>
              <Input
                id="phrase"
                value={formData.phrase}
                onChange={(e) => setFormData({ ...formData, phrase: e.target.value })}
                placeholder="e.g., guaranteed results"
                className="bg-gray-50 border-gray-200 text-[#1A1624]"
              />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value: "critical" | "warning") =>
                  setFormData({ ...formData, category: value })
                }
              >
                <SelectTrigger className="bg-gray-50 border-gray-200 text-[#1A1624]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200">
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Why this phrase is banned..."
                className="bg-gray-50 border-gray-200 text-[#1A1624]"
              />
            </div>
            <div>
              <Label htmlFor="suggestion">Suggestion (Optional)</Label>
              <Textarea
                id="suggestion"
                value={formData.suggestion}
                onChange={(e) => setFormData({ ...formData, suggestion: e.target.value })}
                placeholder="Alternative phrasing to use instead..."
                className="bg-gray-50 border-gray-200 text-[#1A1624]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setIsAddDialogOpen(false)}
              variant="outline"
              className="bg-transparent border-gray-200 text-[#1A1624] hover:bg-gray-100"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitAdd}
              disabled={!formData.phrase || addPhrase.isPending}
              className="bg-gradient-to-br from-[#8B5CF6] to-[#A78BFA] hover:from-[#7C3AED] hover:to-[#8B5CF6]"
            >
              Add Phrase
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="bg-white border-gray-200 text-[#1A1624]">
          <DialogHeader>
            <DialogTitle>Edit Banned Phrase</DialogTitle>
            <DialogDescription className="text-gray-400">
              Update the banned phrase details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-phrase">Phrase</Label>
              <Input
                id="edit-phrase"
                value={formData.phrase}
                onChange={(e) => setFormData({ ...formData, phrase: e.target.value })}
                className="bg-gray-50 border-gray-200 text-[#1A1624]"
              />
            </div>
            <div>
              <Label htmlFor="edit-category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value: "critical" | "warning") =>
                  setFormData({ ...formData, category: value })
                }
              >
                <SelectTrigger className="bg-gray-50 border-gray-200 text-[#1A1624]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200">
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-description">Description (Optional)</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="bg-gray-50 border-gray-200 text-[#1A1624]"
              />
            </div>
            <div>
              <Label htmlFor="edit-suggestion">Suggestion (Optional)</Label>
              <Textarea
                id="edit-suggestion"
                value={formData.suggestion}
                onChange={(e) => setFormData({ ...formData, suggestion: e.target.value })}
                className="bg-gray-50 border-gray-200 text-[#1A1624]"
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-active"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                className="w-4 h-4 rounded border-gray-200 bg-gray-50"
              />
              <Label htmlFor="edit-active" className="cursor-pointer">
                Active
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setIsEditDialogOpen(false)}
              variant="outline"
              className="bg-transparent border-gray-200 text-[#1A1624] hover:bg-gray-100"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitEdit}
              disabled={!formData.phrase || updatePhrase.isPending}
              className="bg-gradient-to-br from-[#8B5CF6] to-[#A78BFA] hover:from-[#7C3AED] hover:to-[#8B5CF6]"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="bg-white border-gray-200 text-[#1A1624]">
          <DialogHeader>
            <DialogTitle>Delete Banned Phrase</DialogTitle>
            <DialogDescription className="text-gray-400">
              Are you sure you want to delete this phrase? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {selectedPhrase && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="font-mono text-sm mb-2">{selectedPhrase.phrase}</p>
              <Badge
                variant={selectedPhrase.category === "critical" ? "destructive" : "default"}
                className={
                  selectedPhrase.category === "critical"
                    ? "bg-red-500/10 text-red-500 border-red-500/20"
                    : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                }
              >
                {selectedPhrase.category}
              </Badge>
            </div>
          )}
          <DialogFooter>
            <Button
              onClick={() => setIsDeleteDialogOpen(false)}
              variant="outline"
              className="bg-transparent border-gray-200 text-[#1A1624] hover:bg-gray-100"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmDelete}
              disabled={deletePhrase.isPending}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete Phrase
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import CSV Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="bg-white border-gray-200 text-[#1A1624] max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Banned Phrases from CSV</DialogTitle>
            <DialogDescription className="text-gray-400">
              Upload or paste CSV content to bulk import banned phrases
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="import-mode">Import Mode</Label>
              <Select
                value={importMode}
                onValueChange={(value: "replace" | "append") => setImportMode(value)}
              >
                <SelectTrigger className="bg-gray-50 border-gray-200 text-[#1A1624]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200">
                  <SelectItem value="append">Append (add to existing phrases)</SelectItem>
                  <SelectItem value="replace">Replace (delete all existing phrases)</SelectItem>
                </SelectContent>
              </Select>
              {importMode === "replace" && (
                <p className="text-sm text-amber-500 mt-2">
                  ⚠️ Warning: This will delete all existing banned phrases and replace them with the imported data.
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="csv-file">Upload CSV File</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="bg-gray-50 border-gray-200 text-[#1A1624]"
              />
            </div>
            <div>
              <Label htmlFor="csv-content">Or Paste CSV Content</Label>
              <Textarea
                id="csv-content"
                value={csvContent}
                onChange={(e) => setCsvContent(e.target.value)}
                placeholder="phrase,category,description,suggestion,active\n&quot;guaranteed results&quot;,critical,&quot;Meta policy violation&quot;,&quot;Use 'proven framework' instead&quot;,true"
                rows={10}
                className="bg-gray-50 border-gray-200 text-[#1A1624] font-mono text-sm"
              />
              <p className="text-xs text-gray-400 mt-2">
                CSV format: phrase, category (critical/warning), description, suggestion, active (true/false)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setIsImportDialogOpen(false);
                setCsvContent("");
              }}
              variant="outline"
              className="bg-transparent border-gray-200 text-[#1A1624] hover:bg-gray-100"
            >
              Cancel
            </Button>
            <Button
              onClick={handleImportCSV}
              disabled={!csvContent.trim() || importCSV.isPending}
              className="bg-gradient-to-br from-[#8B5CF6] to-[#A78BFA] hover:from-[#7C3AED] hover:to-[#8B5CF6]"
            >
              {importCSV.isPending ? "Importing..." : "Import Phrases"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
