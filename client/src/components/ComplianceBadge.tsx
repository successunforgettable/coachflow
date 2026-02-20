import { Shield, CheckCircle, AlertTriangle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface ComplianceIssue {
  severity: 'critical' | 'warning' | 'info';
  phrase: string;
  reason: string;
  suggestion: string;
}

interface ComplianceBadgeProps {
  score: number;
  compliant: boolean;
  issues: ComplianceIssue[];
  suggestions: string[];
  onAutoFix?: () => void; // Optional - for future auto-fix feature
}

export function ComplianceBadge({ score, compliant, issues, suggestions }: ComplianceBadgeProps) {
  const [expanded, setExpanded] = useState(false);

  // Determine badge color and icon
  const getBadgeStyle = () => {
    if (score >= 90) {
      return {
        bg: 'rgba(16, 185, 129, 0.1)',
        border: '#10B981',
        text: '#10B981',
        icon: CheckCircle,
        label: 'Meta Compliant',
        emoji: '✅',
      };
    }
    if (score >= 70) {
      return {
        bg: 'rgba(245, 158, 11, 0.1)',
        border: '#F59E0B',
        text: '#F59E0B',
        icon: AlertTriangle,
        label: 'Mostly Compliant',
        emoji: '⚠️',
      };
    }
    if (score >= 50) {
      return {
        bg: 'rgba(239, 68, 68, 0.1)',
        border: '#EF4444',
        text: '#EF4444',
        icon: XCircle,
        label: 'Review Required',
        emoji: '🚫',
      };
    }
    return {
      bg: 'rgba(220, 38, 38, 0.1)',
      border: '#DC2626',
      text: '#DC2626',
      icon: XCircle,
      label: 'Non-Compliant',
      emoji: '❌',
    };
  };

  const style = getBadgeStyle();
  const Icon = style.icon;
  const hasCriticalIssues = issues.some((i) => i.severity === 'critical');

  return (
    <div
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
        borderRadius: '8px',
        padding: '12px 16px',
        marginTop: '12px',
      }}
    >
      {/* Header - Always Visible */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: issues.length > 0 ? 'pointer' : 'default',
        }}
        onClick={() => issues.length > 0 && setExpanded(!expanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield className="w-5 h-5" style={{ color: style.text }} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: style.text }}>
                {style.label}
              </span>
              <span style={{ fontSize: '18px' }}>{style.emoji}</span>
            </div>
            <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>
              Score: {score}/100
              {issues.length > 0 && ` • ${issues.length} issue${issues.length > 1 ? 's' : ''} found`}
            </div>
          </div>
        </div>

        {issues.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {expanded ? (
              <ChevronUp className="w-4 h-4" style={{ color: '#9CA3AF' }} />
            ) : (
              <ChevronDown className="w-4 h-4" style={{ color: '#9CA3AF' }} />
            )}
          </div>
        )}
      </div>

      {/* Expanded Details */}
      {expanded && issues.length > 0 && (
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(156, 163, 175, 0.2)' }}>
          {/* Critical Issues */}
          {hasCriticalIssues && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#DC2626', marginBottom: '8px' }}>
                ❌ Critical Issues (Will Likely Cause Rejection)
              </div>
              {issues
                .filter((i) => i.severity === 'critical')
                .map((issue, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'rgba(220, 38, 38, 0.05)',
                      border: '1px solid rgba(220, 38, 38, 0.2)',
                      borderRadius: '6px',
                      padding: '10px 12px',
                      marginBottom: '8px',
                    }}
                  >
                    <div style={{ fontSize: '13px', color: '#E5E7EB', marginBottom: '4px' }}>
                      <strong>Flagged phrase:</strong> "{issue.phrase}"
                    </div>
                    <div style={{ fontSize: '12px', color: '#9CA3AF', marginBottom: '6px' }}>
                      {issue.reason}
                    </div>
                    <div style={{ fontSize: '12px', color: '#10B981' }}>
                      💡 <strong>Suggestion:</strong> {issue.suggestion}
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* Warnings */}
          {issues.some((i) => i.severity === 'warning') && (
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#F59E0B', marginBottom: '8px' }}>
                ⚠️ Warnings (May Trigger Review)
              </div>
              {issues
                .filter((i) => i.severity === 'warning')
                .map((issue, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'rgba(245, 158, 11, 0.05)',
                      border: '1px solid rgba(245, 158, 11, 0.2)',
                      borderRadius: '6px',
                      padding: '10px 12px',
                      marginBottom: '8px',
                    }}
                  >
                    <div style={{ fontSize: '13px', color: '#E5E7EB', marginBottom: '4px' }}>
                      <strong>Flagged phrase:</strong> "{issue.phrase}"
                    </div>
                    <div style={{ fontSize: '12px', color: '#9CA3AF', marginBottom: '6px' }}>
                      {issue.reason}
                    </div>
                    <div style={{ fontSize: '12px', color: '#10B981' }}>
                      💡 <strong>Suggestion:</strong> {issue.suggestion}
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* Legal Disclaimer */}
          <div
            style={{
              marginTop: '16px',
              paddingTop: '12px',
              borderTop: '1px solid rgba(156, 163, 175, 0.2)',
              fontSize: '11px',
              color: '#6B7280',
              lineHeight: '1.5',
            }}
          >
            <strong>Disclaimer:</strong> This compliance check is provided as a helpful guide. Final responsibility for ad
            compliance rests with the advertiser. Meta's policies may change.{' '}
            <a
              href="https://www.facebook.com/policies/ads/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#8B5CF6', textDecoration: 'underline' }}
            >
              View Meta Ad Policies →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
