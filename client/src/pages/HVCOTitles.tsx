import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FolderIcon, PlusIcon } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { QuotaIndicator } from "@/components/QuotaIndicator";

export default function HVCOTitles() {
  const { data: hvcoSets, isLoading } = trpc.hvco.list.useQuery();
  const { data: services } = trpc.services.list.useQuery();

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-muted rounded" />
          <div className="h-20 bg-muted rounded" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-48 bg-muted rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">HVCO Titles</h1>
          <p className="text-muted-foreground">
            Craft compelling titles for your high-value content offers to attract and engage your ideal audience.
          </p>
        </div>
        <QuotaIndicator 
          generatorType="hvco" 
          label="HVCO Usage"
        />
      </div>

      {/* Product Card (if services exist) */}
      {services && services.length > 0 && (
        <Card className="p-6 mb-6 bg-card">
          <div className="flex items-start gap-4">
            <FolderIcon className="w-8 h-8 text-primary flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-2">{services[0].name}</h3>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {services[0].description}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="outline">
          View Favourites
        </Button>
        <Link href="/hvco-titles/new">
          <Button className="bg-primary hover:bg-primary/90">
            <PlusIcon className="w-4 h-4 mr-2" />
            Create New HVCO
          </Button>
        </Link>
      </div>

      {/* HVCO Cards Grid */}
      {!hvcoSets || hvcoSets.length === 0 ? (
        <Card className="p-12 text-center">
          <FolderIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No HVCO Titles Yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first HVCO title set to get started
          </p>
          <Link href="/hvco-titles/new">
            <Button className="bg-primary hover:bg-primary/90">
              <PlusIcon className="w-4 h-4 mr-2" />
              Create New HVCO
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {hvcoSets.map((set) => (
            <Card key={set.hvcoSetId} className="p-6 hover:border-primary/50 transition-colors">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-2">
                    HVCO #{set.hvcoSetId.slice(0, 8)}
                  </h3>
                  <p className="text-lg font-medium line-clamp-2 mb-3">
                    {set.sampleTitle}
                  </p>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {set.targetMarket}
                  </p>
                </div>
                <Link href={`/hvco-titles/${set.hvcoSetId}`}>
                  <Button className="w-full bg-green-600 hover:bg-green-700">
                    View HVCO
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
