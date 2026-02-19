# Campaign Builder War Plan

## Overview
Build a visual campaign management system that allows users to create, organize, and track marketing campaigns by linking together assets (headlines, ads, emails, landing pages, etc.) into cohesive workflows.

## Phase 1: Database Schema Design (30 min)

### Tables Required

**1. campaigns**
- id (primary key)
- userId (foreign key → users.id)
- name (string, required)
- description (text, optional)
- status (enum: 'draft', 'active', 'paused', 'completed')
- startDate (datetime, optional)
- endDate (datetime, optional)
- createdAt (datetime)
- updatedAt (datetime)

**2. campaign_assets**
- id (primary key)
- campaignId (foreign key → campaigns.id)
- assetType (enum: 'headline', 'hvco', 'hero_mechanism', 'ad_copy', 'email_sequence', 'whatsapp_sequence', 'landing_page', 'offer')
- assetId (string - references the specific asset's ID/setId)
- position (integer - for ordering in timeline)
- notes (text, optional)
- createdAt (datetime)

**3. campaign_links**
- id (primary key)
- campaignId (foreign key → campaigns.id)
- sourceAssetId (foreign key → campaign_assets.id)
- targetAssetId (foreign key → campaign_assets.id)
- linkType (enum: 'leads_to', 'supports', 'requires')
- createdAt (datetime)

### Migration Steps
1. Create schema definitions in `drizzle/schema.ts`
2. Generate migration SQL with `pnpm drizzle-kit generate`
3. Apply migration via `webdev_execute_sql`
4. Verify schema in database

---

## Phase 2: Backend API (2-3 hours)

### Database Helpers (`server/db.ts`)

**Campaign CRUD:**
- `createCampaign(data)` - Create new campaign
- `getCampaignsByUserId(userId)` - List user's campaigns
- `getCampaignById(campaignId, userId)` - Get single campaign with assets
- `updateCampaign(campaignId, userId, data)` - Update campaign details
- `deleteCampaign(campaignId, userId)` - Delete campaign and all assets/links
- `duplicateCampaign(campaignId, userId)` - Clone campaign with all assets

**Campaign Assets:**
- `addAssetToCampaign(campaignId, assetType, assetId, position)` - Link asset to campaign
- `removeAssetFromCampaign(assetId)` - Unlink asset from campaign
- `updateAssetPosition(assetId, newPosition)` - Reorder assets in timeline
- `getAssetsByCampaignId(campaignId)` - Get all assets for a campaign

**Campaign Links:**
- `createCampaignLink(campaignId, sourceAssetId, targetAssetId, linkType)` - Create connection
- `deleteCampaignLink(linkId)` - Remove connection
- `getLinksByCampaignId(campaignId)` - Get all links for visualization

### tRPC Router (`server/routers/campaigns.ts`)

**Procedures:**
```typescript
campaigns.list // Get all user campaigns
campaigns.get // Get campaign by ID with assets and links
campaigns.create // Create new campaign
campaigns.update // Update campaign details
campaigns.delete // Delete campaign
campaigns.duplicate // Clone campaign

campaigns.addAsset // Add asset to campaign
campaigns.removeAsset // Remove asset from campaign
campaigns.reorderAssets // Update asset positions

campaigns.linkAssets // Create link between assets
campaigns.unlinkAssets // Remove link between assets
```

### Testing
- Create vitest tests for all CRUD operations
- Test asset linking and unlinking
- Test campaign duplication
- Verify authorization (users can only access their own campaigns)

---

## Phase 3: Frontend Components (4-5 hours)

### Component Structure

**1. CampaignList.tsx** (`client/src/pages/CampaignList.tsx`)
- Display all user campaigns in a grid/list
- Show campaign status, asset count, dates
- Actions: Create, Edit, Delete, Duplicate, View
- Filter by status (draft, active, paused, completed)
- Search by name

**2. CampaignBuilder.tsx** (`client/src/pages/CampaignBuilder.tsx`)
- Main campaign builder interface
- Left sidebar: Campaign details (name, description, dates, status)
- Center: Timeline/canvas for drag-and-drop
- Right sidebar: Asset library (available assets to add)
- Bottom: Link creation tools

**3. CampaignTimeline.tsx** (`client/src/components/CampaignTimeline.tsx`)
- Visual timeline showing campaign assets in sequence
- Drag-and-drop reordering
- Visual connections between linked assets
- Asset cards with preview and actions

**4. AssetLibrary.tsx** (`client/src/components/AssetLibrary.tsx`)
- Tabbed interface for different asset types
- Search/filter assets
- Drag assets from library to timeline
- Preview asset content on hover

**5. AssetCard.tsx** (`client/src/components/AssetCard.tsx`)
- Display asset preview (headline text, ad copy snippet, etc.)
- Asset type badge
- Actions: View full content, Remove from campaign, Add notes
- Connection points for linking

### Drag-and-Drop Implementation

**Library:** `@dnd-kit/core` + `@dnd-kit/sortable`

**Features:**
- Drag assets from library to timeline
- Reorder assets within timeline
- Visual feedback during drag
- Auto-save position changes

**Implementation Steps:**
1. Install dependencies: `pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`
2. Wrap CampaignBuilder in `DndContext`
3. Make AssetLibrary items draggable with `useDraggable`
4. Make Timeline droppable with `useDroppable`
5. Handle `onDragEnd` to add assets and update positions

### Asset Linking UI

**Visual Connections:**
- Use SVG lines to connect asset cards
- Color-code by link type (leads_to = blue, supports = green, requires = red)
- Click asset → Click another asset → Select link type → Create link
- Hover over link to see details, click X to delete

**Implementation:**
- Track selected asset in state
- Calculate SVG path between card positions
- Use `react-xarrows` or custom SVG rendering

---

## Phase 4: Campaign Templates (2-3 hours)

### Pre-built Templates

**1. Product Launch Campaign**
- Headlines → Ad Copy → Landing Page → Email Sequence
- 5-day email sequence with urgency
- Offer at the end

**2. Webinar Funnel**
- Headlines → Ad Copy → Landing Page (registration) → Email Sequence (reminders) → WhatsApp Sequence (follow-up)

**3. Lead Magnet Campaign**
- Headlines → Ad Copy → Landing Page (opt-in) → Email Sequence (nurture)

**4. Evergreen Sales Campaign**
- Headlines → HVCO → Hero Mechanisms → Ad Copy → Landing Page → Offer

### Template System

**Database:**
- `campaign_templates` table with predefined structure
- Store as JSON: `{ assets: [...], links: [...] }`

**UI:**
- "Start from Template" button on CampaignList
- Template gallery with previews
- Select template → Duplicate → Customize

---

## Phase 5: Campaign Dashboard Integration (2-3 hours)

### Navigation Updates

**Add to DashboardLayout sidebar:**
```tsx
{
  title: "Campaigns",
  icon: Layers,
  href: "/campaigns"
}
```

**Routes in App.tsx:**
```tsx
<Route path="/campaigns" component={CampaignList} />
<Route path="/campaigns/:campaignId" component={CampaignBuilder} />
```

### Quick Actions

**From Generator Detail Pages:**
- "Add to Campaign" button on all generator detail pages
- Modal to select existing campaign or create new one
- Auto-link to last added asset if applicable

**From Services:**
- "Create Campaign from Service" button
- Pre-populate campaign with all service-related assets

---

## Phase 6: Testing & Polish (1-2 hours)

### Manual Testing Checklist
- [ ] Create campaign from scratch
- [ ] Add assets from library
- [ ] Reorder assets via drag-and-drop
- [ ] Create links between assets
- [ ] Delete links
- [ ] Remove assets from campaign
- [ ] Update campaign details
- [ ] Duplicate campaign
- [ ] Delete campaign
- [ ] Create campaign from template
- [ ] Add asset from generator detail page

### Vitest Tests
- [ ] Campaign CRUD operations
- [ ] Asset management (add, remove, reorder)
- [ ] Link management (create, delete)
- [ ] Campaign duplication
- [ ] Authorization checks

### UI/UX Polish
- [ ] Loading states for all mutations
- [ ] Error handling with toast notifications
- [ ] Empty states (no campaigns, no assets)
- [ ] Responsive design (mobile-friendly)
- [ ] Keyboard shortcuts (Delete key to remove asset, Escape to cancel)

---

## Technical Decisions

### Why @dnd-kit over react-beautiful-dnd?
- Better TypeScript support
- More flexible API
- Active maintenance
- Smaller bundle size

### Why SVG for connections?
- Precise positioning
- Scalable without quality loss
- Easy to animate
- Browser-native rendering

### Why separate campaign_links table?
- Flexible relationship types
- Easy to query connections
- Supports future analytics (track which links perform best)

---

## Estimated Timeline

| Phase | Task | Time |
|-------|------|------|
| 1 | Database Schema | 30 min |
| 2 | Backend API | 2-3 hours |
| 3 | Frontend Components | 4-5 hours |
| 4 | Campaign Templates | 2-3 hours |
| 5 | Dashboard Integration | 2-3 hours |
| 6 | Testing & Polish | 1-2 hours |
| **Total** | | **12-17 hours** |

---

## Success Criteria

✅ Users can create and manage campaigns
✅ Users can add any generator output to campaigns
✅ Users can visually link assets to show workflow
✅ Users can reorder assets via drag-and-drop
✅ Users can start from pre-built templates
✅ Users can duplicate campaigns
✅ All operations are tested and working
✅ UI is responsive and intuitive
