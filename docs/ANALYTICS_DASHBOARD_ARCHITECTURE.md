# Analytics Dashboard Architecture

## Overview
Complete analytics system for tracking campaign performance, email metrics, conversions, and ROI across all marketing campaigns in CoachFlow.

## Database Schema

### analytics_events
Tracks individual user interactions (email opens, clicks, conversions).

```sql
CREATE TABLE analytics_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  campaign_id INT NOT NULL,
  asset_id VARCHAR(255),
  asset_type VARCHAR(50),
  event_type ENUM('email_open', 'email_click', 'link_click', 'conversion', 'purchase') NOT NULL,
  user_identifier VARCHAR(255), -- email or user ID
  metadata JSON, -- additional event data
  revenue DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_campaign (campaign_id),
  INDEX idx_asset (asset_id),
  INDEX idx_event_type (event_type),
  INDEX idx_created_at (created_at)
);
```

### campaign_metrics
Aggregated daily metrics for faster dashboard queries.

```sql
CREATE TABLE campaign_metrics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  campaign_id INT NOT NULL,
  metric_date DATE NOT NULL,
  email_opens INT DEFAULT 0,
  email_clicks INT DEFAULT 0,
  link_clicks INT DEFAULT 0,
  conversions INT DEFAULT 0,
  revenue DECIMAL(10, 2) DEFAULT 0,
  spend DECIMAL(10, 2) DEFAULT 0, -- ad spend for ROI calculation
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_campaign_date (campaign_id, metric_date),
  INDEX idx_metric_date (metric_date)
);
```

## Backend API Structure

### Analytics Helpers (`server/db.ts`)

```typescript
// Track individual event
export async function trackAnalyticsEvent(data: {
  campaignId: number;
  assetId?: string;
  assetType?: string;
  eventType: 'email_open' | 'email_click' | 'link_click' | 'conversion' | 'purchase';
  userIdentifier?: string;
  metadata?: any;
  revenue?: number;
}): Promise<number>

// Get campaign metrics for date range
export async function getCampaignMetrics(
  campaignId: number,
  startDate: Date,
  endDate: Date
): Promise<CampaignMetrics[]>

// Get overall metrics across all campaigns
export async function getOverallMetrics(
  userId: number,
  startDate: Date,
  endDate: Date
): Promise<OverallMetrics>

// Calculate ROI for campaign
export async function calculateCampaignROI(
  campaignId: number,
  startDate: Date,
  endDate: Date
): Promise<{ revenue: number; spend: number; roi: number }>

// Get asset performance within campaign
export async function getAssetPerformance(
  campaignId: number,
  startDate: Date,
  endDate: Date
): Promise<AssetMetrics[]>
```

### Analytics Router (`server/routers/analytics.ts`)

```typescript
export const analyticsRouter = router({
  // Track event (public for webhook/tracking pixel)
  trackEvent: publicProcedure
    .input(z.object({
      campaignId: z.number(),
      eventType: z.enum(['email_open', 'email_click', 'link_click', 'conversion', 'purchase']),
      assetId: z.string().optional(),
      assetType: z.string().optional(),
      userIdentifier: z.string().optional(),
      metadata: z.any().optional(),
      revenue: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const eventId = await trackAnalyticsEvent(input);
      return { eventId };
    }),

  // Get campaign metrics
  getCampaignMetrics: protectedProcedure
    .input(z.object({
      campaignId: z.number(),
      startDate: z.string(), // ISO date
      endDate: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const metrics = await getCampaignMetrics(
        input.campaignId,
        new Date(input.startDate),
        new Date(input.endDate)
      );
      return metrics;
    }),

  // Get overall dashboard metrics
  getOverallMetrics: protectedProcedure
    .input(z.object({
      startDate: z.string(),
      endDate: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const metrics = await getOverallMetrics(
        ctx.user.id,
        new Date(input.startDate),
        new Date(input.endDate)
      );
      return metrics;
    }),

  // Calculate ROI
  calculateROI: protectedProcedure
    .input(z.object({
      campaignId: z.number(),
      startDate: z.string(),
      endDate: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const roi = await calculateCampaignROI(
        input.campaignId,
        new Date(input.startDate),
        new Date(input.endDate)
      );
      return roi;
    }),

  // Get asset performance
  getAssetPerformance: protectedProcedure
    .input(z.object({
      campaignId: z.number(),
      startDate: z.string(),
      endDate: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const performance = await getAssetPerformance(
        input.campaignId,
        new Date(input.startDate),
        new Date(input.endDate)
      );
      return performance;
    }),
});
```

## Frontend Components

### Analytics Dashboard Page (`client/src/pages/AnalyticsDashboard.tsx`)

**Layout:**
- Header with date range selector
- 4 KPI cards (Total Campaigns, Total Revenue, Avg Conversion Rate, Overall ROI)
- Revenue Over Time line chart
- Campaign Performance bar chart
- Revenue by Campaign Type pie chart
- Top Performing Campaigns table

**Key Features:**
- Real-time metrics updates
- Date range filtering (Last 7/30/90 days, Custom)
- Export to CSV functionality
- Drill-down to campaign-specific analytics

### ROI Calculator Component (`client/src/components/ROICalculator.tsx`)

**Inputs:**
- Campaign selection
- Ad spend
- Date range

**Outputs:**
- Total revenue
- Total spend
- ROI percentage
- Revenue per dollar spent
- Break-even analysis

### Campaign Analytics Tab (in CampaignBuilder)

**Metrics:**
- Email opens / open rate
- Email clicks / click-through rate
- Link clicks
- Conversions / conversion rate
- Revenue generated
- ROI

**Visualizations:**
- Asset performance comparison
- Conversion funnel
- Revenue attribution by asset

## Data Flow

1. **Event Tracking:**
   - Email service (SendGrid/Mailgun) sends webhook → trackEvent API
   - Landing page tracks clicks → trackEvent API
   - Purchase completed → trackEvent API with revenue

2. **Metrics Aggregation:**
   - Nightly cron job aggregates events into campaign_metrics
   - Real-time queries fall back to raw events if needed

3. **Dashboard Display:**
   - Frontend queries getOverallMetrics for dashboard
   - Frontend queries getCampaignMetrics for campaign-specific views
   - Charts render using recharts library

## Implementation Phases

### Phase 1: Database Schema (30 min)
- Create analytics_events table
- Create campaign_metrics table
- Generate and apply migration

### Phase 2: Backend API (2-3 hours)
- Implement analytics helpers in db.ts
- Create analytics router
- Add event tracking procedures
- Add metrics aggregation procedures

### Phase 3: Analytics Dashboard (3-4 hours)
- Install recharts
- Create AnalyticsDashboard page
- Build KPI cards
- Create charts (line, bar, pie)
- Add date range selector

### Phase 4: Campaign Analytics (2-3 hours)
- Add analytics tab to CampaignBuilder
- Create ROI calculator component
- Add asset performance breakdown

### Phase 5: Testing (1-2 hours)
- Write vitest tests for helpers
- Write vitest tests for router
- Test dashboard with mock data
- Save checkpoint

**Total Estimated Time: 9-13 hours**

## Success Metrics

- ✅ All analytics queries return in < 1 second
- ✅ Dashboard displays real-time metrics
- ✅ ROI calculator accurately computes returns
- ✅ All vitest tests pass
- ✅ Charts render correctly with sample data
