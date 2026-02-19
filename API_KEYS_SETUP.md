# API Keys Setup Guide - Quick Reference

## 🔑 Required API Keys for CoachFlow

### If Deploying on Manus Platform (Recommended)
**✅ NO API KEYS NEEDED!**

All API keys are automatically configured:
- ✅ OpenAI API (via Manus LLM proxy) - Included
- ✅ Stripe - Auto-configured when you claim sandbox
- ✅ Database - Auto-provisioned
- ✅ S3 Storage - Included

**Just click "Publish" and you're live!**

---

### If Self-Hosting on AWS/Other Platforms

You'll need to obtain these API keys manually:

---

## 1️⃣ OpenAI API Key (REQUIRED)

**What it does:** Powers all 9 AI content generators (Headlines, HVCO, Hero Mechanisms, ICP, Ad Copy, Email, WhatsApp, Landing Pages, Offers)

**Where to get it:**
1. Go to: https://platform.openai.com/api-keys
2. Sign up or log in
3. Click **"Create new secret key"**
4. Name it: "CoachFlow Production"
5. Copy the key (starts with `sk-proj-...`)

**Where to add it:**
```bash
# In your .env file:
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Cost:**
- Pay-as-you-go pricing
- Approximately $0.01-0.05 per content generation
- Example: 1,000 generations = $10-50/month

**Important:**
- Keep this key secret (never commit to GitHub)
- Monitor usage at: https://platform.openai.com/usage
- Set spending limits to avoid unexpected charges

---

## 2️⃣ Stripe API Keys (REQUIRED)

**What it does:** Handles subscription payments (Trial $0, Pro $99/mo, Agency $299/mo)

**Where to get it:**
1. Go to: https://dashboard.stripe.com/register
2. Complete account setup (business info, bank account)
3. Go to: https://dashboard.stripe.com/apikeys
4. Copy both keys:
   - **Publishable key** (starts with `pk_live_...` or `pk_test_...`)
   - **Secret key** (starts with `sk_live_...` or `sk_test_...`)

**Where to add it:**
```bash
# In your .env file:
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Webhook Setup (CRITICAL):**
1. Go to: https://dashboard.stripe.com/webhooks
2. Click **"Add endpoint"**
3. Endpoint URL: `https://your-domain.com/api/stripe/webhook`
4. Select events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy the **Signing secret** (starts with `whsec_...`)

```bash
# Add to .env:
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Test Mode vs Live Mode:**
- **Test Mode** (`pk_test_...`, `sk_test_...`): For testing, no real charges
- **Live Mode** (`pk_live_...`, `sk_live_...`): For production, real charges

**Test Card for Testing:**
```
Card Number: 4242 4242 4242 4242
Expiry: Any future date (e.g., 12/25)
CVC: Any 3 digits (e.g., 123)
ZIP: Any 5 digits (e.g., 12345)
```

**Cost:**
- Stripe fee: 2.9% + $0.30 per transaction
- Example: $99 Pro subscription = $3.17 fee (you receive $95.83)

---

## 3️⃣ AWS S3 Credentials (REQUIRED)

**What it does:** Stores PDF exports and user-uploaded files

**Where to get it:**

### Step 1: Create IAM User
1. Go to: https://console.aws.amazon.com/iam/
2. Click **"Users"** → **"Add users"**
3. Username: `coachflow-s3-user`
4. Access type: **Programmatic access** (check the box)
5. Click **"Next: Permissions"**
6. Attach policy: **AmazonS3FullAccess** (or create custom policy)
7. Click **"Next"** → **"Create user"**
8. **IMPORTANT:** Copy the **Access Key ID** and **Secret Access Key** (you won't see them again!)

### Step 2: Create S3 Bucket
1. Go to: https://s3.console.aws.amazon.com/
2. Click **"Create bucket"**
3. Bucket name: `coachflow-storage` (must be globally unique)
4. Region: `us-east-1` (or your preferred region)
5. Uncheck **"Block all public access"** (we need public read access for PDFs)
6. Click **"Create bucket"**

### Step 3: Configure Bucket Policy
1. Click on your bucket → **"Permissions"** → **"Bucket Policy"**
2. Add this policy (replace `coachflow-storage` with your bucket name):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::coachflow-storage/*"
    }
  ]
}
```

**Where to add it:**
```bash
# In your .env file:
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_S3_BUCKET=coachflow-storage
AWS_S3_REGION=us-east-1
```

**Cost:**
- Storage: $0.023 per GB/month
- Requests: $0.005 per 1,000 PUT requests, $0.0004 per 1,000 GET requests
- Example: 10 GB storage + 10,000 downloads = ~$0.30/month

---

## 4️⃣ Database (PostgreSQL)

**What it does:** Stores user data, subscriptions, generated content, campaigns

**Where to get it:**

### Option A: AWS RDS (Recommended for AWS deployment)
1. Go to: https://console.aws.amazon.com/rds/
2. Click **"Create database"**
3. Engine: **PostgreSQL**
4. Version: **14.x or higher**
5. Template: **Free tier** (for testing) or **Production** (for live)
6. DB instance identifier: `coachflow-db`
7. Master username: `coachflow_admin`
8. Master password: (create a strong password)
9. Instance size: **db.t3.micro** (free tier) or **db.t3.small** (production)
10. Storage: 20 GB (auto-scaling enabled)
11. Click **"Create database"**
12. Wait 5-10 minutes for provisioning
13. Copy the **Endpoint** (e.g., `coachflow-db.xxxxxx.us-east-1.rds.amazonaws.com`)

**Where to add it:**
```bash
# In your .env file:
DATABASE_URL=postgresql://coachflow_admin:your-password@coachflow-db.xxxxxx.us-east-1.rds.amazonaws.com:5432/postgres
```

### Option B: Heroku Postgres (Easier, managed)
1. Go to: https://www.heroku.com/postgres
2. Create account and provision database
3. Copy connection string

### Option C: Railway (Modern, developer-friendly)
1. Go to: https://railway.app/
2. Create project → Add PostgreSQL
3. Copy connection string

**Cost:**
- AWS RDS db.t3.micro: $15-20/month
- Heroku Postgres: $5-50/month (depending on plan)
- Railway: $5-20/month

---

## 5️⃣ Other Required Environment Variables

**Where to add these:**
```bash
# In your .env file:

# Application
NODE_ENV=production
PORT=3000
VITE_APP_TITLE=CoachFlow
VITE_APP_LOGO=/logo.png

# Manus OAuth (for authentication)
VITE_APP_ID=your-manus-app-id
JWT_SECRET=your-random-secret-key-at-least-32-characters-long
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://portal.manus.im
OWNER_OPEN_ID=your-manus-owner-id
OWNER_NAME=Your Name

# Analytics (optional)
VITE_ANALYTICS_ENDPOINT=https://analytics.example.com
VITE_ANALYTICS_WEBSITE_ID=your-website-id
```

**How to generate JWT_SECRET:**
```bash
# Run this command to generate a random 32-character secret:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 📋 Complete .env File Template

Copy this template and fill in your values:

```bash
# ============================================
# CoachFlow Environment Variables
# ============================================

# Database
DATABASE_URL=postgresql://username:password@host:5432/database

# OpenAI API (REQUIRED)
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Stripe (REQUIRED)
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# AWS S3 (REQUIRED)
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_S3_BUCKET=coachflow-storage
AWS_S3_REGION=us-east-1

# Authentication
VITE_APP_ID=your-manus-app-id
JWT_SECRET=your-random-secret-key-at-least-32-characters-long
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://portal.manus.im
OWNER_OPEN_ID=your-manus-owner-id
OWNER_NAME=Your Name

# Application
NODE_ENV=production
PORT=3000
VITE_APP_TITLE=CoachFlow
VITE_APP_LOGO=/logo.png

# Optional: Manus Built-in APIs (only if using Manus LLM proxy)
BUILT_IN_FORGE_API_URL=https://forge.manus.im
BUILT_IN_FORGE_API_KEY=your-manus-forge-api-key

# Optional: Analytics
VITE_ANALYTICS_ENDPOINT=https://analytics.example.com
VITE_ANALYTICS_WEBSITE_ID=your-website-id
```

---

## ✅ Verification Checklist

Before launching, verify all API keys are working:

### Test OpenAI API
```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer YOUR_OPENAI_API_KEY"

# Expected: List of available models (gpt-4, gpt-3.5-turbo, etc.)
```

### Test Stripe API
```bash
curl https://api.stripe.com/v1/customers \
  -u YOUR_STRIPE_SECRET_KEY:

# Expected: List of customers (empty if new account)
```

### Test AWS S3
```bash
aws s3 ls s3://your-bucket-name --region us-east-1

# Expected: List of files (empty if new bucket)
```

### Test Database Connection
```bash
psql "postgresql://username:password@host:5432/database" -c "SELECT version();"

# Expected: PostgreSQL version info
```

---

## 🚨 Security Best Practices

1. **Never commit .env file to GitHub**
   - Add `.env` to `.gitignore` (already done)
   - Use environment variables in production

2. **Rotate API keys regularly**
   - Change keys every 90 days
   - Immediately rotate if compromised

3. **Use different keys for development and production**
   - Test keys for local development
   - Live keys only on production server

4. **Monitor API usage**
   - Set up billing alerts in OpenAI dashboard
   - Monitor Stripe transactions daily
   - Check AWS billing monthly

5. **Restrict API key permissions**
   - Use least-privilege principle
   - Create separate IAM users for different services

---

## 💡 Pro Tips

1. **Start with test mode** (Stripe, OpenAI)
   - Use `pk_test_...` and `sk_test_...` for Stripe
   - Use lower-cost OpenAI models for testing (gpt-3.5-turbo)

2. **Set spending limits**
   - OpenAI: Set monthly budget at https://platform.openai.com/account/billing/limits
   - AWS: Set up billing alerts at https://console.aws.amazon.com/billing/

3. **Monitor costs daily**
   - Check OpenAI usage dashboard
   - Review Stripe transactions
   - Monitor AWS billing

4. **Keep backup keys**
   - Store API keys in password manager (1Password, LastPass)
   - Keep encrypted backup of .env file

---

## 🆘 Troubleshooting

### "OPENAI_API_KEY is not configured"
- Verify key is in .env file
- Restart server after adding key
- Check key starts with `sk-proj-...`

### "Stripe webhook signature verification failed"
- Verify `STRIPE_WEBHOOK_SECRET` matches webhook secret in Stripe dashboard
- Check webhook endpoint URL is correct
- Ensure webhook is receiving events (check Stripe dashboard)

### "S3 access denied"
- Verify IAM user has S3 permissions
- Check bucket policy allows public read access
- Verify `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are correct

### "Database connection failed"
- Verify `DATABASE_URL` is correct
- Check database server is running
- Verify firewall allows connections from your app server

---

## 📞 Support

### API Provider Support
- **OpenAI:** https://help.openai.com/
- **Stripe:** https://support.stripe.com/
- **AWS:** https://aws.amazon.com/support/

### Manus Platform Support
- **Help Center:** https://help.manus.im

---

**Last Updated:** February 20, 2026
**Version:** 1.0.0

---

## 🎯 Quick Start Summary

**Deploying on Manus? (Recommended)**
- ✅ No API keys needed
- ✅ Just click "Publish"
- ✅ You're live in minutes!

**Self-hosting on AWS?**
1. Get OpenAI API key → https://platform.openai.com/api-keys
2. Get Stripe keys → https://dashboard.stripe.com/apikeys
3. Set up AWS S3 → https://console.aws.amazon.com/s3/
4. Set up PostgreSQL → https://console.aws.amazon.com/rds/
5. Copy .env template above and fill in values
6. Deploy following DEPLOYMENT_GUIDE.md

**Questions?** See DEPLOYMENT_GUIDE.md for detailed instructions.
