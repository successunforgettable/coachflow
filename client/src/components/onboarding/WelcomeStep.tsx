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
        <h3 className="text-3xl font-bold">Welcome to CoachFlow!</h3>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          The all-in-one marketing automation platform for coaches, speakers, and consultants.
          Let's get you set up in just 5 simple steps.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mt-12">
        <div className="text-center space-y-3 p-6 rounded-lg border bg-card">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
            <Target className="h-6 w-6 text-primary" />
          </div>
          <h4 className="font-semibold">Define Your Service</h4>
          <p className="text-sm text-muted-foreground">
            Create your first service offering and target market
          </p>
        </div>

        <div className="text-center space-y-3 p-6 rounded-lg border bg-card">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
            <Zap className="h-6 w-6 text-primary" />
          </div>
          <h4 className="font-semibold">Generate Marketing Assets</h4>
          <p className="text-sm text-muted-foreground">
            AI-powered ICP and headlines tailored to your audience
          </p>
        </div>

        <div className="text-center space-y-3 p-6 rounded-lg border bg-card">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
            <TrendingUp className="h-6 w-6 text-primary" />
          </div>
          <h4 className="font-semibold">Launch Your Campaign</h4>
          <p className="text-sm text-muted-foreground">
            Organize assets into a cohesive marketing workflow
          </p>
        </div>
      </div>

      <div className="bg-muted/50 rounded-lg p-6 mt-8">
        <h4 className="font-semibold mb-2">What you'll accomplish:</h4>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">✓</span>
            <span>Create your first service and define your ideal customer</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">✓</span>
            <span>Generate AI-powered marketing copy and headlines</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">✓</span>
            <span>Build your first campaign with organized marketing assets</span>
          </li>
        </ul>
      </div>

      <div className="text-center text-sm text-muted-foreground mt-6">
        This will take approximately 5-10 minutes
      </div>
    </div>
  );
}
