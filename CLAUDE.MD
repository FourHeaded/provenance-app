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
├── App.jsx                  # Root: auth gate, onboarding gate, routes, theme, userSettings init
├── App.css                  # All app-wide styles (one file, ~5000+ lines)
├── main.jsx                 # Entry point, BrowserRouter wrap
├── index.css                # Minimal reset
├── firebase.js              # Firebase init + exports (auth, db, storage, providers)
├── categories.js            # PRESET_CATEGORIES list for assets
├── provenancePrompts.js     # Per-category prompt chips for ProvenanceNotes
├── admin.js                 # ADMIN_UID constant + isAdmin(user) helper (must match firestore.rules)
├── ProvenanceNotes.jsx      # Reusable notes component (origin/history/meaning/legacy)
├── ProvenanceNotes.css      # Styles scoped to provenance notes
├── AssetDetail.jsx          # LEGACY — replaced by pages/AssetDetailPage.jsx, kept for now
│
├── Components/
│   ├── BottomNav.jsx        # Bottom tab bar (Home/Registry/+Add/Documents/Profile)
│   ├── BottomNav.css
│   ├── PhotoUploadButtons.jsx  # Reusable [Take Photo / Choose from Library] picker
│   ├── MultiScanFlow.jsx    # Full-screen multi-item AI scan overlay used by AddAsset
│   └── Logo.jsx             # Wordmark + ornament logo (used by LoginScreen)
│
└── Pages/
    ├── Home.jsx             # Dashboard: stats, quick actions, category breakdown, recent assets
    ├── Registry.jsx         # List/gallery toggle, search, sort, category filter, total bar
    ├── AddAsset.jsx         # Add form with AI photo ID + multi-scan + provenance starter notes
    ├── AssetDetailPage.jsx  # Asset detail with edit, photos, documents (incl. camera scan), notes
    ├── Documents.jsx        # Estate Planning Document Center (10 categories)
    ├── Profile.jsx          # User info, plan, beneficiaries, archive, theme, sign out, delete account
    ├── Archive.jsx          # Soft-deleted assets with reinstate / permanent delete
    ├── Reports.jsx          # PLACEHOLDER — not yet built
    ├── SharedRegistry.jsx   # Read-only view for invited beneficiaries
    ├── Onboarding.jsx       # 4-screen PRE-login flow; final screen embeds sign-in
    ├── LoginScreen.jsx      # Google + Apple + email/password sign-in (accepts initialMode prop)
    ├── AdminDashboard.jsx   # Operator-only: stats, users table, premium toggle, delete user
    ├── Terms.jsx            # Public Terms of Service page
    └── Privacy.jsx          # Public Privacy Policy page
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
| `/registry` | Registry | Asset list (list/gallery toggle, sort, search, category filter) |
| `/add` | AddAsset | New asset (with AI photo ID + multi-scan) |
| `/asset/:id` | AssetDetailPage | Detail + photos + documents (incl. camera scan) + notes |
| `/documents` | Documents | Estate planning document center |
| `/profile` | Profile | User + beneficiaries + theme + delete account |
| `/archive` | Archive | Soft-deleted assets |
| `/reports` | Reports | Placeholder |
| `/shared/:ownerUid` | SharedRegistry | Read-only view for beneficiaries (no BottomNav) |
| `/admin` | AdminDashboard | Operator-only — gated by `isAdmin(user)` from `src/admin.js` |
| `/terms` | Terms | Public — renders even when signed out |
| `/privacy` | Privacy | Public — renders even when signed out |

**Pre-login vs post-login rendering** — when `!user`, App.jsx renders one of two things outside the `<Routes>` tree:
1. **First-time signed-out visit** (no `prov-onboarding-seen` localStorage flag) → `<Onboarding>` walks the user through 4 screens, the last of which embeds Google/Apple/email sign-in.
2. **Returning signed-out visit** (flag is set, e.g. user signed out from Profile) → `<LoginScreen>` directly. Tapping "Use email instead" inside Onboarding also flips App.jsx to render `<LoginScreen initialMode="signin">` for the email form.

The flag is set in the auth listener whenever a sign-in succeeds. Once a user has any successful sign-in on this browser, they bypass the onboarding slides forever.

Post-login Onboarding is now vestigial — `userSettings.onboardingComplete` is auto-set to `true` on new doc creation, and any legacy account missing the flag is unconditionally backfilled in App.jsx's init logic.

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
    {
      name, type, url, storagePath, uploadedAt,
      // Optional fields populated by the AssetDetailPage camera-scan flow:
      scannedFromCamera: boolean,    // true if added via "Scan with Camera"
      vendor: string,                // extracted by AI (may be empty)
      date:   string,                // ISO date YYYY-MM-DD or empty (NOT uploadedAt)
      amount: number | null,         // dollar amount or null
      notes:  string,                // 1-sentence freeform from AI
    }
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
- An `isAdmin()` helper at the top of the rules hardcodes the same UID as `src/admin.js` (`6Oqu1jFasvYOKauEqotgCMeQH7o1`). Both must be kept in sync — Firestore rules can't import JS.
- `assets`: any authenticated user can `read` (needed for shared view); owner OR admin can `write`/`create`. Any authenticated user can `update` if and only if the diff touches **only** the `interestedParties` field (this is how Express Interest works).
- `userSettings`: read/update/delete allowed when `resource.data.uid == request.auth.uid` OR `isAdmin()`. Create requires `request.resource.data.uid == request.auth.uid`. The rule checks the **field**, not the document ID. Admin also has explicit `read, update` from a separate allow line.
- `invites`: admin can read all. Owner can CRUD their own invites; invited user can read invites where their email matches `invitedEmail`. Update/delete is owner OR admin.
- `estateDocs`: owner OR admin can read/delete; owner can update; owner can create. Beneficiaries can `read` if their email is in `sharedWith` or if `'__all__'` is in `sharedWith` (uses `.get('sharedWith', [])` so missing field doesn't error).

**Storage** (`storage.rules`):
- `users/{uid}/{allPaths=**}` — read/write only when `request.auth.uid == uid`. Everything else blocked.

---

## Built features

### Authentication
- Google sign-in (popup)
- Apple sign-in (popup) — **requires Firebase Console + Apple Developer Service ID setup before it works.** Marked "Coming soon" in the UI.
- Email/password sign-in and account creation, with `updateProfile` to set `displayName`
- Friendly error messages mapped from Firebase auth error codes
- Post-login redirect: `/shared/...` paths are saved to `sessionStorage` before login and restored after
- **Sign-in lives in two places**: the standalone `LoginScreen.jsx` (used for returning users + the "Use email instead" path) AND the final screen of `Onboarding.jsx` (Google/Apple/email handlers duplicated inline). Both call into the same Firebase auth.

### Onboarding (first-time users) — pre-login flow
- 4 screens: Welcome ("Your legacy, documented") → Features ("Everything in one place") → Steps ("Getting started is easy") → Sign-in ("You're all set")
- **Shows BEFORE sign-in**, not after. The final screen embeds the social/email sign-in buttons; signing in is the only way out of screen 4.
- Skip button on screens 2–3, jumps to screen 4 (the sign-in screen). Skipping does NOT bypass login.
- Progress dots, slide-in animation between screens
- "Use email instead" on screen 4 calls an `onUseEmail` callback in App.jsx, which flips state to render `<LoginScreen initialMode="signin">`
- `localStorage` flag `prov-onboarding-seen` is set on every successful sign-in. Returning signed-out users skip the slides entirely and land directly on `LoginScreen`.
- `userSettings.onboardingComplete` is auto-set to `true` when a new userSettings doc is created (since the user has already walked through the slides), and unconditionally backfilled for any legacy account missing it. The post-login `<Onboarding>` block in App.jsx is now unreachable in normal flow.

### Home (Dashboard)
- Total asset count, total value
- Quick action buttons (Add, Registry, Documents, Reports)
- Category breakdown bars
- Recent assets list

### Registry
- **List view / gallery view toggle** in the top-right of the page header (two icon buttons in a `.registry-view-toggle` pill). Persisted to `localStorage` as `prov-registry-view`.
- **Single horizontally scrollable sort row** between the search bar and the category filter chips (`.sort-bar`, scrollbar hidden). 6 sort options: Newest (default) / Oldest / Name A–Z / Name Z–A / Value High–Low / Value Low–High. Persisted as `prov-registry-sort`. Missing `createdAt` sorts to end; missing `value` treated as 0; missing `name` treated as `''`. Sort is the last step after search + category filter.
- **List view** (`.asset-list-rows` / `.asset-list-row`): 64×64 thumbnail, name/category eyebrow/description info block, value + optional `details.condition` + chevron on the right. The outer `.asset-list` card wrapper was removed — the list sits directly on the page background.
- **Gallery view**: assets grouped by category, each group has a header (italic Cormorant + item count) and a 2-col `.gallery-grid` of square `.gallery-card`s (photo + name + value). Categories sorted alphabetically; items within keep the active sort order. Empty groups skipped.
- **Results meta line** above the list/gallery: `"N items"` (list) or `"N items · X categories"` (gallery), in `.registry-results-meta`.
- **Total value bar** below the list/gallery — sums `value` across the currently filtered/sorted set (not all assets).
- **Thumbnail fallback chain**: `imageUrl → imageBase64 → centered SVG placeholder div`. Both list and gallery use the same `renderThumb(asset, kind)` helper.
- Real-time search by name/category/description
- Category filter chips that compose with search and sort
- Filters out archived items client-side
- Pending items section (from MultiScanFlow) and the "Generate Registry Export" nudge are unchanged.

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
- **`handleAdditionalPhoto` auto-promotes**: if no primary photo exists yet (`!imageUrl && !imageBase64`), an "additional" upload is sent to `${photoBase}/hero` and written to `imageUrl` instead of being appended to `additionalImages[]`. This mirrors the AddAsset flow's first-photo-becomes-primary contract.
- **Documents** attached to the asset: PDF/image/Word, opens in new tab, delete with confirm
- **Document camera scan** (the "Scan with Camera" button next to "+ Attach Document"): camera-only file input (`capture="environment"`), photo is base64-encoded and sent to Anthropic to extract `documentType` (Receipt/Appraisal/Insurance/Invoice/Certificate/Warranty/Other), `title`, `vendor`, `date`, `amount`, `notes`. An inline `.doc-scan-preview` confirmation panel renders the photo + editable fields (title input, doc-type pill row, date, $-prefixed amount, notes textarea) with Cancel / Save Document. On save, the file uploads to `${docBase}/{Date.now()}.jpg` and a doc object with `scannedFromCamera: true` is appended to `documents[]`. Parse errors silently fall through to an empty form.
- **Scanned doc display**: doc rows with `scannedFromCamera === true` show a small "Scanned" badge in `--accent-slate` next to the name, and a `.doc-scan-meta` line below the upload date showing `formatMoney(amount)` · `formatLongDate(date)` when those values are present.
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
- Avatar (Google photo or initial fallback), editable display name (synced to both `userSettings.displayName` and Firebase Auth `updateProfile`), email
- Plan badge — Profile reads `userSettings?.isPremium || false` (this one IS hooked up to Firestore; AddAsset and AssetDetailPage are still hardcoded — see "isPremium gating" below)
- **Beneficiaries** section: invite form (name, email, relationship dropdown), list with status badges (pending/accepted/declined), revoke, copy invite link
- Archive menu row → `/archive`
- **Admin Dashboard menu row** → `/admin`, only rendered when `isAdmin(user)` returns true
- **Appearance** section with dark/light theme toggle (persisted to `localStorage` as `prov-theme`, applied via `data-theme` attribute on `<html>`)
- **Legal** section with Terms / Privacy links
- Sign out
- **Delete Account** (small `.delete-account-link` text link below Sign Out, faint with danger hover). Click reveals a `.delete-confirm-panel` with the warning copy and a red "Delete My Account" button. Sequence: delete `assets` → `userSettings` → `invites` → `estateDocs` → recursive Storage wipe under `users/{uid}/` (via `listAll` + `deleteObject` walked into `prefixes`) → `deleteUser(auth.currentUser)` → `navigate('/')`. On `auth/requires-recent-login` it shows "For security, please sign out and sign back in before deleting your account." Other failures show a generic error and clear the loading state.

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

### Admin Dashboard (`/admin`)
- Operator-only — gated client-side by `isAdmin(user)` from `src/admin.js`, server-side by the matching `isAdmin()` helper in `firestore.rules`. Non-admins are redirected to `/`.
- Loads all `userSettings`, `assets`, and `invites` collections (admin-read rules permit this).
- **Stats grid**: total users, total assets, new users (7d), new assets (7d), avg assets/user, total invites
- **Category breakdown bars** across all assets in the system
- **Users table**: name, email, UID, asset count, created, last login, plan toggle (clickable to flip `isPremium` on that user), and a **Delete** button. Clicking Delete reveals an `.admin-delete-confirm` panel beneath the row with the limitation note ("Firestore data deleted. To remove the Auth account, delete from Firebase Console → Authentication."). On confirm: same Firestore + Storage wipe sequence as Profile self-delete, but skips step 6 (deleting the auth account requires the Admin SDK and isn't possible from the browser).
- **Recent Assets** table (last 20 by `createdAt`) and **Recent Invites** table (last 20 by `createdAt`)
- **System** panel: environment, app version (injected by Vite), admin UID, and an Anthropic API "Test connection" button that pings Haiku and reports OK/error inline.

---

## Anthropic API
- Three places call Claude directly:
  1. `ProvenanceNotes.jsx` — "Help me write" writing assist (gated by `isPremium`)
  2. `AddAsset.jsx` — single-photo asset identification (factual fields + provenance starters)
  3. `Components/MultiScanFlow.jsx` — multi-item scan, returns up to 8 items per photo
  4. `AssetDetailPage.jsx` — document camera scan, extracts `documentType`/`title`/`vendor`/`date`/`amount`/`notes` from a receipt/appraisal photo
- `AdminDashboard.jsx` also has a "Test connection" button (uses Haiku)
- API key in `.env` as `VITE_ANTHROPIC_API_KEY`
- Called directly from the browser with `'anthropic-dangerous-direct-browser-access': 'true'` header
- **The key is bundled into the client JS at build time** — visible to anyone who inspects the bundle. Acceptable trade-off for v1; should be moved behind a server function eventually.
- Model: `claude-sonnet-4-20250514` (test ping uses `claude-haiku-4-5-20251001`)

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

Mostly hardcoded. Places to know about:
- `Profile.jsx`: reads `userSettings?.isPremium || false` — this one IS hooked up to Firestore. The Admin Dashboard's plan toggle writes to the same field, so an admin can grant premium to any user and it'll show on their Profile.
- `AddAsset.jsx`: `const isPremium = true` — enables AI photo identification (so we can test it). Still hardcoded.
- `AssetDetailPage.jsx`: passes `isPremium={false}` to `<ProvenanceNotes>` — disables AI writing assist. Still hardcoded.
- App.jsx loads `isPremium` from userSettings on init and stores it in component state, but doesn't currently pass it down to AddAsset (route renders `<AddAsset user={user} isPremium={isPremium} />` — so AddAsset DOES receive it as a prop, but its component default `isPremium = true` overrides). Worth auditing during the payments wiring.

When payments are wired, finish replacing the hardcoded values with the real flag.

---

## Known issues / TODOs

- **`Reports.jsx` is still a placeholder.** No reports built yet.
- **`AssetDetail.jsx` (root, not in pages/) is dead code.** Replaced by `pages/AssetDetailPage.jsx`. Safe to delete.
- **Apple sign-in won't work until configured in Firebase Console.** Need an Apple Developer account, a Service ID, the domain registered, and Apple enabled in Firebase Auth → Sign-in method. Both `LoginScreen.jsx` and the Onboarding screen-4 sign-in panel show the button but it'll fail. The Onboarding screen labels it "Coming soon" beneath the button.
- **`isPremium` is partially hardcoded** — see "isPremium gating" above. Profile reads from Firestore; AddAsset and AssetDetailPage are still hardcoded.
- **`VITE_ANTHROPIC_API_KEY` is in the client bundle** — known security trade-off. Should be moved behind a Cloud Function or server proxy before serious launch.
- **Email beneficiary invites are clipboard-only.** No SendGrid / SES / Firebase Extensions integration yet.
- **`additionalImages` array can contain a mix of types** — legacy entries are plain base64 strings, new entries are `{url, storagePath}` objects. The render code handles both via `typeof item === 'string'` checks.
- **No real "accepted/declined" flow on invites.** The schema supports it but the only way to set `accepted` right now would be manually in Firestore; in practice, presence of a non-declined invite is enough to grant access.
- **`userSettings` collection mixes patterns**: most reads/writes use `addDoc` + `where('uid', '==', ...)` (auto-IDs with a `uid` field). The original rule incorrectly assumed doc-ID = uid; this has been fixed to check the `uid` field.
- **Firestore composite indexes**: queries that combine two `where` clauses on different fields will require composite indexes. The shared estate docs query uses `array-contains-any` against a single field then filters by `uid` client-side specifically to avoid this.
- **Admin "Delete user" cannot remove the Firebase Auth account** from the browser — that requires the Admin SDK. The confirmation panel says so. If you need to fully purge a test user, delete their Firestore data via the admin button, then remove the Auth row from Firebase Console → Authentication.
- **MultiScanFlow does not save the source photo to scanned items** — it sends the photo to AI for identification then discards it. Created assets get `imageUrl: ''`. This came up during the photo-upload audit and may be worth wiring later if scanned items should carry the source photo.
