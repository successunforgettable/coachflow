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
    <div
      style={{
        padding: 'var(--card-padding-md)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-subtle)',
        borderLeft: '4px solid #F59E0B',
        background: 'var(--bg-secondary)',
        position: 'relative',
      }}
    >
      <button
        onClick={handleDismiss}
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '4px',
          color: 'var(--text-tertiary)',
        }}
      >
        <X className="h-3 w-3" />
      </button>
      <div className="flex items-start gap-2">
        <AlertCircle className="h-4 w-4 flex-shrink-0" style={{ color: '#F59E0B', marginTop: '2px' }} />
        <div className="flex-1 pr-6">
          <h3 className="text-sm font-semibold mb-1" style={{ color: '#F59E0B' }}>
            Action Required: Claim Your Stripe Test Sandbox
          </h3>
          <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
            Your Stripe test sandbox expires in <span className="font-semibold" style={{ color: '#F59E0B' }}>{daysRemaining} days</span> (April 17, 2026). 
            Claim it now to test subscription payments and ensure your billing system works correctly.
          </p>
          <a
            href={CLAIM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs inline-flex items-center gap-1"
            style={{ color: 'var(--accent-primary)' }}
          >
            Claim Stripe Sandbox <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
