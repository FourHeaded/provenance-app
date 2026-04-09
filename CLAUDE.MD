# Provenance App

## What this is
A premium estate asset registry app. Users catalog valuable personal items, document their stories, share their registry with beneficiaries, and store estate planning documents in one place. Built with React + Vite + Firebase.

---

## Tech stack
- **React 19** with Vite 8 (`type: module`)
- **React Router v6** (BrowserRouter, wrapped in main.jsx)
- **Firebase 12**: Auth (Google + Apple + email/password), Firestore, Storage, Hosting
- **Custom CSS** in `App.css` and `ProvenanceNotes.css` (no Tailwind, no CSS-in-JS)
- **Anthropic API** called directly from the browser via `fetch` for AI features

Project ID: `provenance-510ad`. Live URL: `https://provenance-510ad.web.app`.

---

## Design system

**Colors** (CSS variables defined in `:root` in App.css):
- `--surface-0: #0D0D0D` — page background
- `--surface-1: #1A1A1A` — card background
- `--surface-2: #2A2A2A` — input/secondary background
- `--text-primary: #F6F4EF`
- `--text-secondary: #C7C7C7`
- `--text-faint: #555`
- `--accent-gold: #D4A94E` — primary accent
- `--accent-gold-light: #E8C06A`, `--accent-gold-dark: #A67E2D`
- `--accent-gold-glow: rgba(212, 169, 78, 0.12)` — used for hover/badge fills
- `--border-soft: #2F2F2F`

**Fonts**:
- Playfair Display (serif) — headings, page titles, section labels (often italic)
- Inter (sans) — body, buttons, inputs

**Dark mode only**. No light mode toggle currently.

**Common components/classes**:
- `.page` / `.page-header` / `.page-title` — page wrapper and header
- `.btn-primary` (gold), `.btn-ghost` (outline), `.btn-small`, `.btn-danger`, `.btn-back`
- `.section-label` — italic Playfair section heading
- `.placeholder-text` — dashed empty state
- `.asset-card`, `.detail-card` — card surfaces

---

## File structure

```
src/
├── App.jsx                  # Root: auth gate, onboarding gate, routes
├── App.css                  # All app-wide styles (one file, ~3000 lines)
├── main.jsx                 # Entry point, BrowserRouter wrap
├── index.css                # Minimal reset
├── firebase.js              # Firebase init + exports (auth, db, storage, providers)
├── categories.js            # PRESET_CATEGORIES list for assets
├── provenancePrompts.js     # Per-category prompt chips for ProvenanceNotes
├── ProvenanceNotes.jsx      # Reusable notes component (origin/history/meaning/legacy)
├── ProvenanceNotes.css      # Styles scoped to provenance notes
├── AssetDetail.jsx          # LEGACY — replaced by pages/AssetDetailPage.jsx, kept for now
│
├── Components/
│   ├── BottomNav.jsx        # Bottom tab bar (Home/Registry/+Add/Documents/Profile)
│   └── BottomNav.css
│
└── Pages/
    ├── Home.jsx             # Dashboard: stats, quick actions, category breakdown, recent assets
    ├── Registry.jsx         # Asset list with search + category filter chips + thumbnails
    ├── AddAsset.jsx         # Add form with AI photo identification + provenance starter notes
    ├── AssetDetailPage.jsx  # Asset detail with edit, photos, documents, provenance notes
    ├── Documents.jsx        # Estate Planning Document Center (10 categories)
    ├── Profile.jsx          # User info, plan, beneficiaries, archive link, sign out
    ├── Archive.jsx          # Soft-deleted assets with reinstate / permanent delete
    ├── Reports.jsx          # PLACEHOLDER — not yet built
    ├── SharedRegistry.jsx   # Read-only view for invited beneficiaries
    ├── Onboarding.jsx       # 4-screen first-time user flow
    └── LoginScreen.jsx      # Google + Apple + email/password sign-in
```

**Root config files**:
- `firebase.json` — Hosting (`dist/`), Firestore rules, Storage rules
- `firestore.rules` — Security rules for all collections
- `storage.rules` — `users/{uid}/...` is owner-only
- `.firebaserc` — Project alias

---

## Routes

| Path | Component | Notes |
|---|---|---|
| `/` | Home | Dashboard |
| `/registry` | Registry | Asset list |
| `/add` | AddAsset | New asset (with AI photo ID) |
| `/asset/:id` | AssetDetailPage | Detail + photos + docs + notes |
| `/documents` | Documents | Estate planning document center |
| `/profile` | Profile | User + beneficiaries |
| `/archive` | Archive | Soft-deleted assets |
| `/reports` | Reports | Placeholder |
| `/shared/:ownerUid` | SharedRegistry | Read-only view for beneficiaries (no BottomNav) |

The login screen is shown when `!user`. The onboarding flow is shown when a signed-in user has no `onboardingComplete: true` in their userSettings. Both render outside the `<Routes>` tree.

---

## Data model (Firestore)

### `assets`
```
{
  uid: string,                  // owner
  name, category, value, description: string,
  notes: { origin, history, meaning, legacy },
  imageUrl: string,             // Firebase Storage URL (preferred)
  imageBase64: string,          // LEGACY fallback
  additionalImages: [           // array of objects (legacy entries may be plain strings)
    { url, storagePath }
  ],
  documents: [                  // attached to a specific asset
    { name, type, url, storagePath, uploadedAt }
  ],
  interestedParties: [          // beneficiaries who hit "Express Interest"
    { email, name, expressedAt }
  ],

  // Nested field groups (added in the data/fields pass).
  // Always update via Firestore dot notation
  // (e.g. 'ownership.acquiredFrom') so siblings aren't overwritten.
  details: {
    condition: 'Excellent' | 'Good' | 'Fair' | 'Poor' | '',
    location:  string,          // free text, e.g. "Safe deposit box — First Bank"
  },
  ownership: {
    acquisitionType: 'Purchased' | 'Inherited' | 'Gifted' | 'Commissioned' | 'Other' | '',
    acquiredFrom:    string,
    acquiredDate:    string,    // ISO date YYYY-MM-DD
    purchasePrice:   number,
  },
  insurance: {
    insurer:        string,
    policyNumber:   string,
    coverageAmount: number,
    lastAppraised:  string,     // ISO date YYYY-MM-DD
    appraisedBy:    string,
  },
  assignedBeneficiary: string,  // invite document ID `{ownerUid}_{email}`, or '' if unassigned

  itemStatus: 'archived' | undefined,
  createdAt, updatedAt
}
```

### `userSettings`
Auto-ID documents (NOT keyed by uid). The uid is stored as a field.
```
{
  uid: string,
  customCategories: string[],
  onboardingComplete: boolean
}
```

### `invites`
```
{
  registryOwnerUid: string,
  ownerName: string,
  invitedName: string,
  invitedEmail: string,         // lowercased
  relationship: string,         // Spouse, Child, Sibling, etc.
  status: 'pending' | 'accepted' | 'declined',
  createdAt, expiresAt          // expiresAt = createdAt + 30 days
}
```

### `estateDocs` (Estate Planning Document Center)
```
{
  uid: string,
  categoryId: string,           // 'will', 'poa-financial', 'trust', etc.
  title, notes, attorney: string,
  status: 'Current' | 'Draft' | 'Superseded',
  version: string,
  docDate: ISO date,
  filename, fileType: string,
  storagePath, url: string,     // Firebase Storage
  sharedWith: string[],         // emails, or ['__all__'] for everyone with access
  uploadedAt, lastReviewed: ISO datetime
}
```

### Storage paths
- Asset photos: `users/{uid}/assets/{assetId}/photos/{filename}`
  - Hero photo uses fixed name `photos/hero`
- Asset documents: `users/{uid}/assets/{assetId}/documents/{filename}`
- Estate docs: `users/{uid}/estate-docs/{categoryId}/{filename}`

---

## Security rules

**Firestore** (`firestore.rules`):
- `assets`: any authenticated user can `read` (needed for shared view); only owner can `write`/`create`. Any authenticated user can `update` if and only if the diff touches **only** the `interestedParties` field (this is how Express Interest works).
- `userSettings`: read/write/create allowed when `resource.data.uid == request.auth.uid` (or `request.resource.data.uid` for create). The rule checks the **field**, not the document ID.
- `invites`: owner can CRUD their own invites; invited user can read invites where their email matches `invitedEmail`.
- `estateDocs`: owner has full access; beneficiaries can `read` if their email is in `sharedWith` or if `'__all__'` is in `sharedWith` (uses `.get('sharedWith', [])` so missing field doesn't error).

**Storage** (`storage.rules`):
- `users/{uid}/{allPaths=**}` — read/write only when `request.auth.uid == uid`. Everything else blocked.

---

## Built features

### Authentication
- Google sign-in (popup)
- Apple sign-in (popup) — **requires Firebase Console + Apple Developer Service ID setup before it works**
- Email/password sign-in and account creation, with `updateProfile` to set `displayName`
- Friendly error messages mapped from Firebase auth error codes
- Post-login redirect: `/shared/...` paths are saved to `sessionStorage` before login and restored after

### Onboarding (first-time users)
- 4 screens: Welcome → Features → How it works → Ready
- Skip button on screens 2–3, jumps to final screen
- Progress dots, slide-in animation between screens
- Stores `onboardingComplete: true` in `userSettings` on completion
- Returning users skip directly to home

### Home (Dashboard)
- Total asset count, total value
- Quick action buttons (Add, Registry, Documents, Reports)
- Category breakdown bars
- Recent assets list

### Registry
- Asset cards with thumbnail (Firebase Storage URL or default SVG placeholder)
- Real-time search by name/category/description
- Category filter chips that compose with search
- Filters out archived items client-side

### Add Asset
- Photo upload at top of form
- **AI photo identification** via Anthropic API (`claude-sonnet-4-20250514`):
  - Returns JSON with `name`, `category`, `estimatedValue`, `description`, plus four provenance starters
  - Factual fields are filled directly
  - `origin`, `meaning`, `legacy` are sentence starters ending in `...` for the user to finish
  - `history` is 2–3 collector-perspective sentences about the make/model/brand
  - Category fuzzy-matched against `PRESET_CATEGORIES` + user's custom categories
- Provenance note sections rendered inline below the form fields
- Photo uploaded to Firebase Storage at `users/{uid}/assets/{assetId}/photos/hero` after the Firestore doc is created (so we have an ID)
- Custom category creation with persistence to userSettings
- `isPremium = true` hardcoded for AI testing

### Asset Detail Page
- View/edit name, category, value, description (toggle Edit mode)
- Hero image upload with "Change photo"
- **Photos gallery**: 3-column grid, click for lightbox, delete on hover, hero image always shown first
- **Documents** attached to the asset: PDF/image/Word, opens in new tab, delete with confirm
- All photos/documents stored in Firebase Storage; legacy base64 still rendered if present
- **Provenance Notes** component with per-section autosave and AI assist (gated by `isPremium`)
- "Move to Archive" instead of permanent delete (sets `itemStatus: 'archived'`)

### Provenance Notes
- 4 sections: Origin / History / Meaning / Legacy
- Per-category prompt chips that drop sentence starters
- "Help me write" AI button gated by `isPremium` (passed false from AssetDetail)
- Debounced autosave (1.5s after stop typing)

### Documents (Estate Planning Document Center)
- 10 categories with empty-state guidance text:
  Will, POA Financial, POA Healthcare, Living Will, Trust, Beneficiary Designations, Insurance, Property Deeds, Tax, Other Legal
- Collapsible category sections
- Per-doc fields: title, version, status (Current/Draft/Superseded), docDate, attorney, notes
- Annual review tracking with `lastReviewed` and a flag (⚑) on docs older than 1 year
- Banner at top of page showing total review-due count
- **Per-document sharing** via reusable `ShareSettings` panel: Everyone / Specific beneficiaries / Private
- **Bulk sharing mode**: toolbar button enters selection mode; checkboxes appear on rows; "Share Selected" applies one set of sharing settings to all selected docs at once
- Files in Firebase Storage; old versions kept (mark as Superseded) for audit trail

### Profile
- Avatar (Google photo or initial fallback), name, email
- Plan badge (`isPremium = false` hardcoded)
- **Beneficiaries** section: invite form (name, email, relationship dropdown), list with status badges (pending/accepted/declined), revoke, copy invite link
- Archive menu row → `/archive`
- Sign out

### Archive
- Lists assets where `itemStatus === 'archived'`
- Reinstate (sets status back to 'active')
- Permanent delete with inline confirmation (calls `deleteDoc`)

### Beneficiary Invite system
- Owner creates invites in Profile → `invites` collection
- Invite link format: `https://provenance-510ad.web.app/shared/{ownerUid}`
- Link auto-copied to clipboard on creation; manual "Copy link" button on each row
- Shared via email is **not** implemented — copy/paste only

### Shared Registry (`/shared/:ownerUid`)
- Validates access by querying `invites` for `registryOwnerUid + invitedEmail == user.email + status != declined`
- Owner can preview their own shared registry (`user.uid === ownerUid` bypass)
- Read-only asset cards: photo, name, category, value, description, additional photo strip
- **Express Interest** button writes to `interestedParties[]` on the asset (allowed by the field-restricted Firestore update rule)
- **Estate Documents section** showing all documents the owner has shared with this beneficiary
- BottomNav hidden on this route

---

## Anthropic API
- Used in `ProvenanceNotes.jsx` (writing assist) and `AddAsset.jsx` (photo identification)
- API key in `.env` as `VITE_ANTHROPIC_API_KEY`
- Called directly from the browser with `'anthropic-dangerous-direct-browser-access': 'true'` header
- **The key is bundled into the client JS at build time** — visible to anyone who inspects the bundle. Acceptable trade-off for v1; should be moved behind a server function eventually.
- Model: `claude-sonnet-4-20250514`

---

## Deployment

Configured in `firebase.json`:
- **Hosting**: serves `dist/`, SPA rewrite to `/index.html`
- **Firestore**: rules from `firestore.rules`
- **Storage**: rules from `storage.rules`

Deploy commands:
```
npm run build && firebase deploy --only hosting       # Web app
firebase deploy --only firestore:rules                # Firestore rules
firebase deploy --only storage                        # Storage rules
firebase deploy                                       # Everything
```

---

## isPremium gating

Currently hardcoded everywhere. Three places to know about:
- `AddAsset.jsx`: `const isPremium = true` — enables AI photo identification (so we can test it)
- `Profile.jsx`: `const isPremium = false` — shows "Free" badge and upgrade hint
- `AssetDetailPage.jsx`: passes `isPremium={false}` to `<ProvenanceNotes>` — disables AI writing assist

When payments are wired, replace these constants with a real check (probably `userSettings.isPremium` or a Stripe subscription status).

---

## Known issues / TODOs

- **`Reports.jsx` is still a placeholder.** No reports built yet.
- **`AssetDetail.jsx` (root, not in pages/) is dead code.** Replaced by `pages/AssetDetailPage.jsx`. Safe to delete.
- **Apple sign-in won't work until configured in Firebase Console.** Need an Apple Developer account, a Service ID, the domain registered, and Apple enabled in Firebase Auth → Sign-in method.
- **`isPremium` is hardcoded** — see above. AI photo ID is currently free for everyone since `AddAsset` has it set to true.
- **`VITE_ANTHROPIC_API_KEY` is in the client bundle** — known security trade-off. Should be moved behind a Cloud Function or server proxy before serious launch.
- **Email beneficiary invites are clipboard-only.** No SendGrid / SES / Firebase Extensions integration yet.
- **`additionalImages` array can contain a mix of types** — legacy entries are plain base64 strings, new entries are `{url, storagePath}` objects. The render code handles both via `typeof item === 'string'` checks.
- **No real "accepted/declined" flow on invites.** The schema supports it but the only way to set `accepted` right now would be manually in Firestore; in practice, presence of a non-declined invite is enough to grant access.
- **`userSettings` collection mixes patterns**: most reads/writes use `addDoc` + `where('uid', '==', ...)` (auto-IDs with a `uid` field). The original rule incorrectly assumed doc-ID = uid; this has been fixed to check the `uid` field.
- **Firestore composite indexes**: queries that combine two `where` clauses on different fields will require composite indexes. The shared estate docs query uses `array-contains-any` against a single field then filters by `uid` client-side specifically to avoid this.
