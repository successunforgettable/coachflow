import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Star } from "lucide-react";
import { QuotaIndicator } from "@/components/QuotaIndicator";
import { SearchBar } from "@/components/SearchBar";
import { useState } from "react";

export default function Headlines() {
  const { data: headlineSets, isLoading } = trpc.headlines.list.useQuery();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSets = headlineSets?.filter((set) =>
    set.targetMarket.toLowerCase().includes(searchQuery.toLowerCase()) ||
    set.pressingProblem.toLowerCase().includes(searchQuery.toLowerCase()) ||
    set.desiredOutcome.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container max-w-7xl py-8">
      {/* Quota Indicator */}
      <div className="mb-6">
        <QuotaIndicator generatorType="headline" />
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <SearchBar
          placeholder="Search Direct Response Headlines..."
          value={searchQuery}
          onChange={setSearchQuery}
        />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Direct Response Headlines</h1>
          <p className="text-muted-foreground mt-2">
            Generate high-converting headlines using 5 proven formulas
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm">
            <Star className="h-4 w-4 mr-2" />
            View Favourites
          </Button>
          <Link href="/headlines/new">
            <Button className="bg-purple-600 hover:bg-purple-700">
              <Plus className="h-4 w-4 mr-2" />
              Create New Headline
            </Button>
          </Link>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <Input
          type="text"
          placeholder="Search Headlines"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* Headline Sets Grid */}
      {filteredSets && filteredSets.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredSets.map((set) => (
            <Card key={set.headlineSetId} className="p-6">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-lg">
                    Headline Set #{set.headlineSetId.slice(-6)}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {set.count} headlines
                  </span>
                </div>

                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Target Market:</span>
                    <p className="line-clamp-2">{set.targetMarket}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">The main problem you solve:</span>
                    <p className="line-clamp-2">{set.pressingProblem}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">The result your customer wants:</span>
                    <p className="line-clamp-2">{set.desiredOutcome}</p>
                  </div>
                </div>

                <Link href={`/headlines/${set.headlineSetId}`}>
                  <Button variant="action" className="w-full">
                    View Headlines
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <h3 className="text-lg font-semibold mb-2">No headlines yet</h3>
          <p className="text-muted-foreground mb-6">
            Create your first headline set to get started
          </p>
          <Link href="/headlines/new">
            <Button className="bg-purple-600 hover:bg-purple-700">
              <Plus className="h-4 w-4 mr-2" />
              Create New Headline
            </Button>
          </Link>
        </Card>
      )}
    </div>
  );
}
