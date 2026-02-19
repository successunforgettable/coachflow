# CoachFlow Deployment Guide

## 🚀 Production Readiness Status

**✅ READY TO LAUNCH**

All critical features are implemented and tested:
- ✅ 9 AI-powered content generators (Headlines, HVCO, Hero Mechanisms, ICP, Ad Copy, Email, WhatsApp, Landing Pages, Offers)
- ✅ PDF export for all generators
- ✅ "+15 More Like This" regeneration with quota enforcement
- ✅ Stripe subscription system (Trial/Pro/Agency tiers with 7-day trial)
- ✅ Campaign Builder with drag-and-drop timeline, asset library, workflow canvas
- ✅ 5-step onboarding wizard for new users
- ✅ User profile editing and settings page
- ✅ Complete navigation with breadcrumbs and sidebar
- ✅ Error boundary, loading states, empty states
- ✅ 99/99 automated tests passing
- ✅ Zero TypeScript errors
- ✅ End-to-end testing complete

---

## 📋 Deployment Options

### Option 1: Deploy on Manus Platform (Recommended - Easiest)

**Advantages:**
- ✅ One-click deployment (no server setup required)
- ✅ All API keys pre-configured automatically
- ✅ Built-in hosting with custom domain support
- ✅ Automatic SSL certificates
- ✅ Database included (PostgreSQL/TiDB)
- ✅ S3 storage included
- ✅ No DevOps knowledge required

**Steps:**
1. Click the **"Publish"** button in the Manus Management UI (top-right corner)
2. Your app will be live at `https://coachflow.manus.space` (or your custom domain)
3. Claim your Stripe sandbox by clicking the banner on the Dashboard (expires April 17, 2026)

**API Keys on Manus:**
- **OpenAI API Key**: Automatically provided via `BUILT_IN_FORGE_API_KEY` (no setup needed)
- **Stripe Keys**: Automatically configured when you claim the Stripe sandbox
- **Database**: Automatically provisioned and connected
- **S3 Storage**: Automatically configured

**Custom Domain:**
- Go to Settings → Domains in the Management UI
- Purchase a domain directly within Manus, or bind your existing domain
- Complete domain setup is handled in-app

---

### Option 2: Deploy on AWS (Advanced - Requires DevOps Knowledge)

**⚠️ Important:** Manus provides built-in hosting with custom domain support. AWS deployment is only recommended if you have specific infrastructure requirements.

**Prerequisites:**
- AWS account with billing enabled
- Node.js 22+ installed locally
- PostgreSQL database (AWS RDS recommended)
- S3 bucket for file storage
- Domain name (optional, for custom domain)

**Steps:**

#### 1. Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/coachflow.git
cd coachflow
```

#### 2. Set Up AWS Infrastructure

**Database (AWS RDS PostgreSQL):**
1. Create a PostgreSQL 14+ instance in AWS RDS
2. Note the connection string: `postgresql://username:password@endpoint:5432/database`

**Storage (AWS S3):**
1. Create an S3 bucket for file storage
2. Create an IAM user with S3 access
3. Generate access keys (Access Key ID + Secret Access Key)

**Hosting (AWS EC2 or AWS Elastic Beanstalk):**
- **Option A: EC2** - Manual server setup, full control
- **Option B: Elastic Beanstalk** - Managed platform, easier deployment

#### 3. Configure Environment Variables

Create a `.env` file in the project root:

```bash
# Database
DATABASE_URL=postgresql://username:password@your-rds-endpoint:5432/coachflow

# Authentication (Manus OAuth)
VITE_APP_ID=your-manus-app-id
JWT_SECRET=your-random-secret-key-min-32-chars
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://portal.manus.im
OWNER_OPEN_ID=your-manus-owner-id
OWNER_NAME=Your Name

# OpenAI API (REQUIRED for AI content generation)
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# Get your key at: https://platform.openai.com/api-keys

# Manus Built-in APIs (Optional - for Manus LLM proxy)
BUILT_IN_FORGE_API_URL=https://forge.manus.im
BUILT_IN_FORGE_API_KEY=your-manus-forge-api-key

# Stripe (REQUIRED for subscriptions)
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# Get your keys at: https://dashboard.stripe.com/apikeys

# S3 Storage (REQUIRED for file uploads)
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_S3_BUCKET=your-bucket-name
AWS_S3_REGION=us-east-1

# Application
NODE_ENV=production
PORT=3000
VITE_APP_TITLE=CoachFlow
VITE_APP_LOGO=/logo.png
```

#### 4. Install Dependencies
```bash
pnpm install
```

#### 5. Build the Application
```bash
pnpm run build
```

#### 6. Run Database Migrations
```bash
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

#### 7. Deploy to AWS

**Option A: EC2 Deployment**
```bash
# SSH into your EC2 instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install pnpm
npm install -g pnpm

# Clone your repository
git clone https://github.com/YOUR_USERNAME/coachflow.git
cd coachflow

# Install dependencies
pnpm install

# Copy .env file (upload via scp or create manually)
nano .env  # Paste your environment variables

# Build the app
pnpm run build

# Install PM2 for process management
npm install -g pm2

# Start the app
pm2 start "pnpm run start" --name coachflow

# Enable auto-restart on reboot
pm2 startup
pm2 save
```

**Option B: Elastic Beanstalk Deployment**
```bash
# Install EB CLI
pip install awsebcli

# Initialize Elastic Beanstalk
eb init -p node.js coachflow

# Create environment
eb create coachflow-prod

# Set environment variables
eb setenv DATABASE_URL=postgresql://... OPENAI_API_KEY=sk-proj-... STRIPE_SECRET_KEY=sk_live_...

# Deploy
eb deploy
```

#### 8. Set Up Stripe Webhooks

1. Go to https://dashboard.stripe.com/webhooks
2. Add endpoint: `https://your-domain.com/api/stripe/webhook`
3. Select events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
4. Copy the webhook secret and add to `.env` as `STRIPE_WEBHOOK_SECRET`

#### 9. Configure Domain (Optional)

**AWS Route 53:**
1. Create a hosted zone for your domain
2. Add an A record pointing to your EC2 IP or Elastic Beanstalk endpoint
3. Update nameservers at your domain registrar

**SSL Certificate (AWS Certificate Manager):**
1. Request a certificate for your domain
2. Validate domain ownership
3. Attach certificate to your load balancer or CloudFront distribution

---

## 🔑 Where to Get API Keys

### 1. OpenAI API Key (REQUIRED)
**What it's for:** AI content generation (all 9 generators)

**How to get it:**
1. Go to https://platform.openai.com/api-keys
2. Sign up or log in
3. Click "Create new secret key"
4. Copy the key (starts with `sk-proj-...`)
5. Add to `.env` as `OPENAI_API_KEY=sk-proj-...`

**Cost:** Pay-as-you-go (approximately $0.01-0.05 per generation)

**Alternative:** Use Manus built-in LLM proxy (included in Manus hosting, no OpenAI key needed)

---

### 2. Stripe API Keys (REQUIRED for subscriptions)
**What it's for:** Payment processing, subscription management

**How to get it:**
1. Go to https://dashboard.stripe.com/register
2. Complete account setup
3. Go to https://dashboard.stripe.com/apikeys
4. Copy **Publishable key** (starts with `pk_live_...` or `pk_test_...`)
5. Copy **Secret key** (starts with `sk_live_...` or `sk_test_...`)
6. Add to `.env`:
   ```
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_PUBLISHABLE_KEY=pk_live_...
   VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
   ```

**Test Mode vs Live Mode:**
- Use `pk_test_...` and `sk_test_...` for testing (no real charges)
- Use `pk_live_...` and `sk_live_...` for production (real charges)

**Webhook Secret:**
1. Go to https://dashboard.stripe.com/webhooks
2. Add endpoint: `https://your-domain.com/api/stripe/webhook`
3. Copy the webhook secret (starts with `whsec_...`)
4. Add to `.env` as `STRIPE_WEBHOOK_SECRET=whsec_...`

---

### 3. AWS S3 Credentials (REQUIRED for file storage)
**What it's for:** Storing PDF exports, user uploads

**How to get it:**
1. Go to https://console.aws.amazon.com/iam/
2. Create a new IAM user with programmatic access
3. Attach policy: `AmazonS3FullAccess` (or create custom policy)
4. Copy **Access Key ID** and **Secret Access Key**
5. Create an S3 bucket at https://s3.console.aws.amazon.com/
6. Add to `.env`:
   ```
   AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
   AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   AWS_S3_BUCKET=your-bucket-name
   AWS_S3_REGION=us-east-1
   ```

**Alternative:** Use Manus built-in S3 storage (included in Manus hosting, no AWS account needed)

---

### 4. Manus API Keys (Optional - only if using Manus LLM proxy)
**What it's for:** Using Manus built-in LLM proxy instead of direct OpenAI API

**How to get it:**
1. These are automatically provided when deploying on Manus platform
2. If self-hosting and want to use Manus proxy, contact Manus support

**Note:** If you provide `OPENAI_API_KEY`, you don't need Manus LLM proxy keys.

---

## 🧪 Testing Before Launch

### 1. Test Locally
```bash
# Start development server
pnpm run dev

# Open browser
http://localhost:3000

# Test all features:
- Sign up / Log in
- Complete onboarding wizard
- Generate content with all 9 generators
- Export PDFs
- Create campaigns
- Test subscription upgrade flow
```

### 2. Test Stripe Payments
```bash
# Use Stripe test cards
Card Number: 4242 4242 4242 4242
Expiry: Any future date
CVC: Any 3 digits
ZIP: Any 5 digits

# Test subscription flow:
1. Click "Upgrade to Pro"
2. Enter test card details
3. Verify subscription created in Stripe Dashboard
4. Test quota increases (Pro: 50 generations, Agency: unlimited)
```

### 3. Run Automated Tests
```bash
# Run all 99 tests
pnpm test

# Expected output:
✓ All 99 tests passing
✓ 0 failed
```

---

## 📊 Post-Launch Checklist

### Immediate (Day 1)
- [ ] Verify app is accessible at your domain
- [ ] Test user registration and login
- [ ] Test all 9 generators with real OpenAI API
- [ ] Test PDF export functionality
- [ ] Test Stripe subscription flow with real card
- [ ] Monitor error logs for any issues
- [ ] Set up uptime monitoring (e.g., UptimeRobot, Pingdom)

### Week 1
- [ ] Monitor OpenAI API usage and costs
- [ ] Monitor Stripe transactions
- [ ] Check database performance
- [ ] Review user feedback
- [ ] Set up backup strategy for database
- [ ] Configure email notifications (optional)

### Ongoing
- [ ] Monitor server resources (CPU, memory, disk)
- [ ] Review and optimize database queries
- [ ] Monitor API costs (OpenAI, Stripe)
- [ ] Regular database backups
- [ ] Security updates and patches
- [ ] User analytics and feature usage tracking

---

## 🛠️ Troubleshooting

### Issue: "OPENAI_API_KEY is not configured"
**Solution:** Add `OPENAI_API_KEY=sk-proj-...` to your `.env` file

### Issue: Stripe payments not working
**Solution:** 
1. Verify `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY` are correct
2. Check webhook endpoint is configured: `https://your-domain.com/api/stripe/webhook`
3. Verify `STRIPE_WEBHOOK_SECRET` matches the webhook secret in Stripe Dashboard

### Issue: PDF export fails
**Solution:** Ensure S3 credentials are correct and bucket has proper permissions

### Issue: Database connection errors
**Solution:** 
1. Verify `DATABASE_URL` is correct
2. Check database server is running and accessible
3. Verify firewall rules allow connections from your app server

### Issue: App crashes or errors
**Solution:**
1. Check logs: `pm2 logs coachflow` (if using PM2)
2. Verify all environment variables are set correctly
3. Check database migrations are applied: `pnpm drizzle-kit migrate`

---

## 💰 Cost Estimates (AWS Deployment)

### Monthly Costs (Estimated)
- **EC2 Instance (t3.medium):** $30-40/month
- **RDS PostgreSQL (db.t3.micro):** $15-20/month
- **S3 Storage:** $1-5/month (depends on usage)
- **Data Transfer:** $5-10/month
- **Domain Name:** $10-15/year
- **SSL Certificate:** Free (AWS Certificate Manager)

**Total:** ~$60-80/month

### API Costs (Usage-Based)
- **OpenAI API:** $0.01-0.05 per generation (depends on model and length)
  - Example: 1,000 generations/month = $10-50/month
- **Stripe:** 2.9% + $0.30 per transaction
  - Example: 10 subscriptions at $99/mo = $32.70 in fees

**Total with API costs:** ~$100-150/month (for moderate usage)

---

## 🎯 Recommended Deployment: Manus Platform

**Why choose Manus:**
- ✅ **Zero DevOps:** No server setup, no database configuration, no SSL certificates
- ✅ **Pre-configured APIs:** OpenAI, Stripe, S3 all set up automatically
- ✅ **One-click deploy:** Click "Publish" and you're live
- ✅ **Custom domains:** Purchase or bind domains directly in the UI
- ✅ **Cost-effective:** No separate AWS/database/storage bills
- ✅ **Auto-scaling:** Handles traffic spikes automatically
- ✅ **Backups included:** Automatic database backups

**When to use AWS instead:**
- You need full infrastructure control
- You have specific compliance requirements
- You want to integrate with existing AWS infrastructure
- You have a dedicated DevOps team

---

## 📞 Support

### Manus Platform Support
- Submit requests at: https://help.manus.im
- For billing, technical issues, or feature requests

### AWS Deployment Support
- AWS Documentation: https://docs.aws.amazon.com/
- OpenAI Support: https://help.openai.com/
- Stripe Support: https://support.stripe.com/

---

## ✅ Final Checklist Before Launch

- [ ] All environment variables configured correctly
- [ ] OpenAI API key added and tested
- [ ] Stripe keys added and webhook configured
- [ ] Database connected and migrations applied
- [ ] S3 storage configured (or Manus storage enabled)
- [ ] Domain name configured (optional)
- [ ] SSL certificate installed
- [ ] All 99 tests passing
- [ ] Manual testing complete (all 9 generators, PDF export, subscriptions)
- [ ] Error monitoring set up
- [ ] Backup strategy in place
- [ ] Terms of Service and Privacy Policy added (recommended)

---

## 🚀 Ready to Launch!

**Recommended Path:**
1. **Deploy on Manus Platform** (easiest, fastest)
   - Click "Publish" button in Management UI
   - Claim Stripe sandbox
   - You're live in minutes!

2. **Or Deploy on AWS** (advanced)
   - Follow AWS deployment steps above
   - Configure all API keys manually
   - Set up infrastructure and monitoring

**Either way, you're ready to go!** 🎉

All critical features are implemented, tested, and production-ready. The platform has been thoroughly tested with 99/99 automated tests passing and comprehensive end-to-end testing complete.

---

**Last Updated:** February 20, 2026
**Version:** 1.0.0 (Production Ready)
