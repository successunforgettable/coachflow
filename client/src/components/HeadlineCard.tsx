import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Copy, ThumbsUp, ThumbsDown, TrendingUp } from "lucide-react";

interface HeadlineCardProps {
  headline: {
    id: number;
    headline: string;
    eyebrow?: string | null;
    subheadline?: string | null;
    rating?: number | null;
  };
  onRate: (headlineId: number, rating: number) => void;
  onCopy: (text: string) => void;
  onGenerateMore: () => void;
  isGenerating: boolean;
}

export function HeadlineCard({ headline, onRate, onCopy, onGenerateMore, isGenerating }: HeadlineCardProps) {
  const isEyebrowType = !!headline.eyebrow;
  
  const copyText = isEyebrowType 
    ? `${headline.eyebrow}\n${headline.headline}\n${headline.subheadline}`
    : headline.headline;

  return (
    <Card className="p-6">
      {isEyebrowType ? (
        <div className="mb-4">
          <p className="text-xs text-purple-600 font-semibold uppercase mb-2">{headline.eyebrow}</p>
          <p className="text-lg font-bold mb-2">{headline.headline}</p>
          <p className="text-sm text-muted-foreground">{headline.subheadline}</p>
        </div>
      ) : (
        <p className="text-lg mb-4">{headline.headline}</p>
      )}
      
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant={headline.rating === 1 ? "default" : "outline"}
            size="sm"
            onClick={() => onRate(headline.id, headline.rating === 1 ? 0 : 1)}
          >
            <ThumbsUp className="h-4 w-4" />
          </Button>
          <Button
            variant={headline.rating === -1 ? "destructive" : "outline"}
            size="sm"
            onClick={() => onRate(headline.id, headline.rating === -1 ? 0 : -1)}
          >
            <ThumbsDown className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onCopy(copyText)}
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="bg-purple-600 hover:bg-purple-700 text-white"
            onClick={onGenerateMore}
            disabled={isGenerating}
          >
            {isGenerating ? "Generating..." : "+15 More Like This"}
          </Button>
          <Button variant="outline" size="sm">
            <TrendingUp className="h-4 w-4 mr-2" />
            Report CTR
          </Button>
        </div>
      </div>
    </Card>
  );
}
