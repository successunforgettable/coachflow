# CoachFlow

**AI-Powered Marketing Automation for Coaches, Speakers, and Consultants**

Generate 300+ high-converting marketing assets in one afternoon with 9 AI-powered content generators, integrated email/WhatsApp/SMS sequences, and complete campaign planning.

---

## 🚀 Features

### 9 AI Content Generators
1. **Headlines Generator** - 25 high-converting headlines across 5 proven formulas
2. **HVCO Titles** - 50 compelling titles for high-value content offers
3. **Hero Mechanisms** - 15 unique mechanisms with supporting copy
4. **ICP Generator** - Detailed customer profiles with 17 comprehensive sections
5. **Ad Copy Generator** - Complete ad campaigns with 15 variations
6. **Email Sequences** - 5-email sequences using proven frameworks
7. **WhatsApp Sequences** - 7-message mobile-first sequences
8. **Landing Pages** - Complete landing page copy with 5 angle variations
9. **Offers Generator** - Irresistible offers with pricing, bonuses, and guarantees

### Additional Features
- **Campaign Builder** - Organize all assets into cohesive campaigns
- **PDF Export** - Export any generated content as professional PDFs
- **Power Mode** - Generate 3x more variations in a single generation
- **Source of Truth** - Store service details once, use everywhere
- **Analytics Dashboard** - Track usage and performance
- **Subscription Management** - Stripe-powered billing (Trial/Pro/Agency tiers)

---

## 💻 Tech Stack

- **Frontend**: React 19 + TypeScript + Tailwind CSS 4 + shadcn/ui
- **Backend**: Express 4 + tRPC 11
- **Database**: MySQL (TiDB) with Drizzle ORM
- **Authentication**: Manus OAuth
- **Payments**: Stripe
- **AI**: OpenAI GPT-4 (via Manus LLM API)
- **Storage**: AWS S3 (via Manus Storage API)

---

## 📦 Installation

```bash
# Install dependencies
pnpm install

# Run database migrations
pnpm db:push

# Start development server
pnpm dev
```

---

## 🏗️ Project Structure

```
client/
  src/
    pages/          # Page components
    components/     # Reusable UI components
    hooks/          # Custom React hooks
    lib/            # Utilities and helpers
    
server/
  routers.ts        # tRPC API routes
  db.ts             # Database query helpers
  _core/            # Framework plumbing (OAuth, LLM, etc.)
  
drizzle/
  schema.ts         # Database schema
  migrations/       # SQL migration files
  
docs/               # Documentation
```

---

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run specific test file
pnpm test server/auth.test.ts
```

**Test Coverage**: 99 tests across 13 test files

---

## 🚀 Deployment

### Option 1: Manus Platform (Recommended)
1. Click "Publish" in Management UI
2. Custom domain support included
3. Zero configuration required

### Option 2: Self-Hosting
See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for detailed instructions on deploying to AWS, Railway, or other platforms.

---

## 🔑 Environment Variables

When self-hosting, you'll need:

- `DATABASE_URL` - MySQL connection string
- `JWT_SECRET` - Session signing secret
- `STRIPE_SECRET_KEY` - Stripe API key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
- `OPENAI_API_KEY` - OpenAI API key (for AI generation)

See [API_KEYS_SETUP.md](./API_KEYS_SETUP.md) for detailed setup instructions.

**Note**: When deploying on Manus Platform, all environment variables are automatically configured.

---

## 📊 Pricing

- **Trial**: 7 days free, 3 generations per tool
- **Pro**: $99/month, 50 generations per tool, Power Mode
- **Agency**: $299/month, unlimited generations, Power Mode, white-label

---

## 📝 Documentation

- [Deployment Guide](./DEPLOYMENT_GUIDE.md) - Complete deployment instructions
- [API Keys Setup](./API_KEYS_SETUP.md) - How to obtain and configure API keys
- [Token Cost Analysis](./TOKEN_COST_ANALYSIS.md) - Per-user token costs and profitability
- [Profitability Calculator](./PROFITABILITY_CALCULATOR.md) - Revenue and cost modeling
- [Rebranding Guide](./REBRANDING_GUIDE.md) - How to rebrand the platform
- [War Plan](./REBRANDING_WAR_PLAN.md) - Complete rebrand execution plan

---

## 🤝 Contributing

This is a private project. For questions or support, please contact the project owner.

---

## 📄 License

Proprietary - All rights reserved

---

## 🎯 Roadmap

- [ ] Multi-language support
- [ ] Additional AI models (Claude, Gemini)
- [ ] Team collaboration features
- [ ] API access for integrations
- [ ] Mobile app (iOS/Android)

---

**Built with ❤️ for coaches, speakers, and consultants who want to scale their marketing without scaling their team.**
