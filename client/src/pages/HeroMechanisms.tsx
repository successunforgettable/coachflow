import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FolderIcon, PlusIcon } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { QuotaIndicator } from "@/components/QuotaIndicator";
import { SearchBar } from "@/components/SearchBar";
import { useState } from "react";

export default function HeroMechanisms() {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: mechanismSets, isLoading } = trpc.heroMechanisms.list.useQuery();
  const { data: services } = trpc.services.list.useQuery();

  const filteredSets = mechanismSets?.filter((set) =>
    set.targetMarket.toLowerCase().includes(searchQuery.toLowerCase()) ||
    set.pressingProblem.toLowerCase().includes(searchQuery.toLowerCase()) ||
    set.sampleName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    set.desiredOutcome.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <h1 className="text-3xl font-bold mb-2">Your Unique Method</h1>
          <p className="text-muted-foreground">
            Highlight the unique features and benefits that set your product apart.
          </p>
        </div>
        <QuotaIndicator 
          generatorType="heroMechanism" 
          label="Unique Method Usage"
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

      {/* Search Bar */}
      <div className="mb-6">
        <SearchBar
          placeholder="Search Unique Methods..."
          value={searchQuery}
          onChange={setSearchQuery}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="outline">
          View Favourite Methods
        </Button>
        <Link href="/hero-mechanisms/new">
          <Button className="bg-primary hover:bg-primary/90">
            <PlusIcon className="w-4 h-4 mr-2" />
            Create New Unique Method
          </Button>
        </Link>
      </div>

      {/* Hero Mechanism Cards Grid */}
      {!mechanismSets || mechanismSets.length === 0 ? (
        <Card className="p-12 text-center">
          <FolderIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Unique Methods Yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first hero mechanism set to get started
          </p>
          <Link href="/hero-mechanisms/new">
            <Button className="bg-primary hover:bg-primary/90">
              <PlusIcon className="w-4 h-4 mr-2" />
              Create New Unique Method
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {mechanismSets.map((set) => (
            <Card key={set.mechanismSetId} className="p-6 hover:border-primary/50 transition-colors">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-2">
                    Unique Method #{set.mechanismSetId.slice(0, 8)}
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Target Market</p>
                      <p className="text-sm line-clamp-2">{set.targetMarket}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">The main problem you solve</p>
                      <p className="text-sm line-clamp-3">{set.pressingProblem}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">The result your customer wants</p>
                      <p className="text-sm line-clamp-2">{set.desiredOutcome}</p>
                    </div>
                  </div>
                </div>
                <Link href={`/hero-mechanisms/${set.mechanismSetId}`}>
                  <Button className="w-full bg-green-600 hover:bg-green-700">
                    View Unique Methods
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
