# CoachFlow Database Schema

## Overview

This document defines the complete database schema for CoachFlow, designed to support services, campaigns, content generation, sequences, and analytics.

---

## Core Tables

### users
Already exists from web-db-user scaffold. Extended with:
```sql
ALTER TABLE users ADD COLUMN subscription_plan VARCHAR(20) DEFAULT 'free';
ALTER TABLE users ADD COLUMN subscription_status VARCHAR(20) DEFAULT 'trial';
ALTER TABLE users ADD COLUMN trial_ends_at TIMESTAMP;
ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(255);
ALTER TABLE users ADD COLUMN stripe_subscription_id VARCHAR(255);
```

### services
Central hub for coach/speaker/consultant offerings (simplified vs Kong's products)
```sql
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL, -- 'coaching', 'speaking', 'consulting'
  description TEXT NOT NULL,
  target_customer VARCHAR(500) NOT NULL,
  main_benefit VARCHAR(500) NOT NULL,
  price DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_services_user_id ON services(user_id);
```

### campaigns
Organize all marketing assets into cohesive campaigns
```sql
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  campaign_type VARCHAR(50), -- 'webinar', 'challenge', 'course_launch', 'product_launch'
  status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'active', 'paused', 'completed'
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX idx_campaigns_service_id ON campaigns(service_id);
```

---

## Generator Output Tables

### ideal_customer_profiles
Simplified vs Kong's Dream Buyers (5 sections vs 17+ tabs)
```sql
CREATE TABLE ideal_customer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  demographics JSONB, -- age_range, occupation, income_level
  pain_points TEXT,
  desired_outcomes TEXT,
  values_motivations TEXT,
  buying_triggers TEXT,
  rating INTEGER DEFAULT 0, -- -1, 0, 1
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_icp_user_id ON ideal_customer_profiles(user_id);
CREATE INDEX idx_icp_service_id ON ideal_customer_profiles(service_id);
```

### ad_copy
Facebook/social media ad headlines and copy
```sql
CREATE TABLE ad_copy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  ad_type VARCHAR(50), -- 'story', 'authority', 'question', 'social_proof', 'cta'
  headline VARCHAR(500) NOT NULL,
  body_copy TEXT NOT NULL,
  link_description VARCHAR(500),
  rating INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ad_copy_user_id ON ad_copy(user_id);
CREATE INDEX idx_ad_copy_campaign_id ON ad_copy(campaign_id);
```

### email_sequences
Email sequences (NEW - Kong missing)
```sql
CREATE TABLE email_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  sequence_type VARCHAR(50), -- 'welcome', 'engagement', 'sales'
  name VARCHAR(255) NOT NULL,
  emails JSONB NOT NULL, -- array of {day, subject, body, timing}
  automation_enabled BOOLEAN DEFAULT false,
  rating INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_email_sequences_user_id ON email_sequences(user_id);
CREATE INDEX idx_email_sequences_campaign_id ON email_sequences(campaign_id);
```

### whatsapp_sequences
WhatsApp sequences (NEW - Kong missing)
```sql
CREATE TABLE whatsapp_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  sequence_type VARCHAR(50), -- 'engagement', 'sales'
  name VARCHAR(255) NOT NULL,
  messages JSONB NOT NULL, -- array of {day, message, timing, emojis}
  automation_enabled BOOLEAN DEFAULT false,
  rating INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_whatsapp_sequences_user_id ON whatsapp_sequences(user_id);
CREATE INDEX idx_whatsapp_sequences_campaign_id ON whatsapp_sequences(campaign_id);
```

### landing_pages
Landing page copy
```sql
CREATE TABLE landing_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  angle VARCHAR(50), -- 'shock_solve', 'contrarian', 'story', 'authority'
  headline TEXT NOT NULL,
  sections JSONB NOT NULL, -- array of {type, content}
  rating INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_landing_pages_user_id ON landing_pages(user_id);
CREATE INDEX idx_landing_pages_campaign_id ON landing_pages(campaign_id);
```

### offers
Offer packages
```sql
CREATE TABLE offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  offer_type VARCHAR(50), -- 'standard', 'premium', 'vip'
  headline TEXT NOT NULL,
  what_included JSONB NOT NULL, -- array of deliverables
  bonuses JSONB, -- array of {name, value}
  guarantee TEXT,
  price DECIMAL(10,2),
  rating INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_offers_user_id ON offers(user_id);
CREATE INDEX idx_offers_campaign_id ON offers(campaign_id);
```

---

## Campaign Management Tables

### campaign_assets
Links campaigns to generated content
```sql
CREATE TABLE campaign_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  asset_type VARCHAR(50) NOT NULL, -- 'ad_copy', 'email_sequence', 'whatsapp_sequence', 'landing_page', 'offer'
  asset_id UUID NOT NULL,
  order_in_campaign INTEGER DEFAULT 0,
  scheduled_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_campaign_assets_campaign_id ON campaign_assets(campaign_id);
CREATE INDEX idx_campaign_assets_asset_type_id ON campaign_assets(asset_type, asset_id);
```

---

## Analytics Tables

### campaign_analytics
Track campaign performance (NEW - Kong missing)
```sql
CREATE TABLE campaign_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  revenue DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(campaign_id, date)
);

CREATE INDEX idx_campaign_analytics_campaign_id ON campaign_analytics(campaign_id);
CREATE INDEX idx_campaign_analytics_date ON campaign_analytics(date);
```

### asset_performance
Track individual asset performance
```sql
CREATE TABLE asset_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type VARCHAR(50) NOT NULL,
  asset_id UUID NOT NULL,
  metric_type VARCHAR(50) NOT NULL, -- 'impressions', 'clicks', 'opens', 'conversions'
  metric_value INTEGER DEFAULT 0,
  date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(asset_type, asset_id, metric_type, date)
);

CREATE INDEX idx_asset_performance_asset ON asset_performance(asset_type, asset_id);
CREATE INDEX idx_asset_performance_date ON asset_performance(date);
```

---

## Usage Tracking Tables

### usage_quotas
Track monthly usage against subscription limits
```sql
CREATE TABLE usage_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month DATE NOT NULL, -- first day of month
  generator_type VARCHAR(50) NOT NULL, -- 'icp', 'ad_copy', 'email_sequence', etc.
  usage_count INTEGER DEFAULT 0,
  quota_limit INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, month, generator_type)
);

CREATE INDEX idx_usage_quotas_user_month ON usage_quotas(user_id, month);
```

---

## Subscription Plans

### Pro Plan ($49/month)
- 3 services
- 5 active campaigns
- 50 generations per month per generator
- Email/SMS/WhatsApp integration
- Basic analytics

### Agency Plan ($199/month)
- Unlimited services
- Unlimited campaigns
- Unlimited generations
- All integrations
- Advanced analytics
- Team: 5 additional users

---

## Migration Order

1. Alter users table (subscription fields)
2. Create services table
3. Create campaigns table
4. Create ideal_customer_profiles table
5. Create ad_copy table
6. Create email_sequences table
7. Create whatsapp_sequences table
8. Create landing_pages table
9. Create offers table
10. Create campaign_assets table
11. Create campaign_analytics table
12. Create asset_performance table
13. Create usage_quotas table

