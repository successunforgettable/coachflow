import { useState, useEffect } from 'react';
import { X, ExternalLink, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';

export function StripeSandboxBanner() {
  const [dismissed, setDismissed] = useState(false);
  const EXPIRY_DATE = new Date('2026-04-17T22:21:21.000Z');
  const CLAIM_URL = 'https://dashboard.stripe.com/claim_sandbox/YWNjdF8xUnZUWnBTWVBRV1BhdHMzLDE3NzE4ODUyODMv10052QpgjmO';
  const STORAGE_KEY = 'stripe_sandbox_banner_dismissed';

  useEffect(() => {
    const isDismissed = localStorage.getItem(STORAGE_KEY) === 'true';
    setDismissed(isDismissed);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setDismissed(true);
  };

  // Don't show if dismissed or expired
  if (dismissed || new Date() > EXPIRY_DATE) {
    return null;
  }

  const daysRemaining = Math.ceil((EXPIRY_DATE.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="font-semibold text-orange-500 mb-1">
            Action Required: Claim Your Stripe Test Sandbox
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            Your Stripe test sandbox expires in <span className="font-semibold text-orange-500">{daysRemaining} days</span> (April 17, 2026). 
            Claim it now to test subscription payments and ensure your billing system works correctly.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="bg-orange-500/10 border-orange-500/30 hover:bg-orange-500/20"
            onClick={() => window.open(CLAIM_URL, '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Claim Stripe Sandbox
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="flex-shrink-0"
          onClick={handleDismiss}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
