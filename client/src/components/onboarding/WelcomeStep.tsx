import { Rocket, Target, TrendingUp, Zap } from "lucide-react";

interface WelcomeStepProps {
  data: any;
  onComplete: (data: any) => void;
  onNext: () => void;
}

export default function WelcomeStep({ onNext }: WelcomeStepProps) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10">
          <Rocket className="h-10 w-10 text-primary" />
        </div>
        <h3 className="text-3xl font-bold">You're one setup away from never writing marketing copy from scratch again.</h3>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Join 900,000+ coaches, speakers and consultants who've transformed their marketing with AI — in under 10 minutes.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mt-12">
        <div className="text-center space-y-3 p-6 rounded-lg border bg-card">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
            <Target className="h-6 w-6 text-primary" />
          </div>
          <h4 className="font-semibold">Your Service, Defined</h4>
          <p className="text-sm text-muted-foreground">
            Tell us what you do once. ZAP uses it everywhere.
          </p>
        </div>

        <div className="text-center space-y-3 p-6 rounded-lg border bg-card">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
            <Zap className="h-6 w-6 text-primary" />
          </div>
          <h4 className="font-semibold">Your Dream Client, Mapped</h4>
          <p className="text-sm text-muted-foreground">
            AI builds a complete profile of who you're selling to.
          </p>
        </div>

        <div className="text-center space-y-3 p-6 rounded-lg border bg-card">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
            <TrendingUp className="h-6 w-6 text-primary" />
          </div>
          <h4 className="font-semibold">Your First Campaign, Ready</h4>
          <p className="text-sm text-muted-foreground">
            Headlines, copy and assets — generated before you finish your coffee.
          </p>
        </div>
      </div>

      <div className="text-center text-base text-muted-foreground mt-8 max-w-2xl mx-auto">
        Most coaches spend 80% of their time on marketing and 20% on coaching. We're about to flip that.
      </div>
    </div>
  );
}
