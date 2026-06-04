## Standing Instructions for Claude Code
- After completing any significant changes in a session, update this CLAUDE.md file to reflect the current state of the app — new features built, file structure changes, decisions made, known issues.
- Always use `npm run build && firebase deploy --only hosting` to deploy after changes unless told otherwise.
- Always use `firebase deploy --only firestore:rules` when Firestore rules are changed.
- Commit to GitHub after every significant build: `git add . && git commit -m "descriptive message" && git push`
- The admin UID is hardcoded in `src/admin.js` — never change it without being explicitly asked.
- isPremium is read from userSettings in Firestore — never hardcode it as true or false.

---

# Provenance App

## What this is
A premium estate asset registry app. Users catalog valuable personal items, document their stories, share their registry with beneficiaries, and store estate planning documents in one place. Built with React + Vite + Firebase.

---

## Tech stack
- **React 19** with Vite 8 (`type: module`)
- **React Router v6** (BrowserRouter, wrapped in main.jsx)
- **Firebase 12**: Auth (Google + Apple + email/password), Firestore, Storage, Hosting
- **Firebase Trigger Email extension** — listens to the `mail` collection and sends transactional email automatically (used for invite, accepted, expressed interest, reinstate notifications)
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
- `--accent-slate` — muted secondary accent (used for "View details", "Close", scanned-doc badge, etc.)
- `--border-soft: #2F2F2F`, `--border-faint` (used by row dividers, falls back to `--border-soft` where it isn't defined)
- `--color-danger: #E24B4A` — danger text/link color

**Fonts**:
- Playfair Display (serif) — headings, page titles, section labels (often italic)
- Cormorant Garamond (serif italic) — accent headings inside cards, provenance section labels
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
├── App.jsx                  # Root: auth gate, onboarding gate, public routes, theme, userSettings init
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
│   ├── BottomNav.jsx        # Bottom tab bar (Home/Registry/+Add/Documents/Profile); subscribes to unread notifications for the home-tab dot
│   ├── BottomNav.css
│   ├── PhotoUploadButtons.jsx  # Reusable [Take Photo / Choose from Library] picker
│   ├── MultiScanFlow.jsx    # Full-screen multi-item AI scan overlay used by AddAsset
│   └── Logo.jsx             # Wordmark + ornament logo (used by LoginScreen and SharedRegistry auth gate)
│
└── Pages/
    ├── Home.jsx             # Dashboard: readiness, next steps, Recent Activity feed, header bell
    ├── Registry.jsx         # List/gallery toggle, search, sort, category filter, total bar
    ├── AddAsset.jsx         # Add form with AI photo ID + multi-scan + provenance starter notes
    ├── AssetDetailPage.jsx  # Asset detail with edit, photos, documents, notes, Interest Expressed section
    ├── Documents.jsx        # Estate Planning Document Center (10 categories)
    ├── Profile.jsx          # User info, plan, expandable beneficiaries, archive, theme, sign out, delete account
    ├── Archive.jsx          # Soft-deleted assets with reinstate / permanent delete
    ├── Reports.jsx          # PLACEHOLDER — not yet built
    ├── SharedRegistry.jsx   # Public route — own auth gate, real-time revoke, expandable read-only cards
    ├── Onboarding.jsx       # 4-screen PRE-login flow; final screen embeds sign-in
    ├── LoginScreen.jsx      # Google + Apple + email/password sign-in (accepts initialMode prop)
    ├── AdminDashboard.jsx   # Operator-only: stats, users table (deduped by uid), premium toggle, delete user
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
| `/asset/:id` | AssetDetailPage | Detail + photos + documents + notes + Interest Expressed |
| `/documents` | Documents | Estate planning document center |
| `/profile` | Profile | User + beneficiaries + theme + delete account |
| `/archive` | Archive | Soft-deleted assets |
| `/reports` | Reports | Placeholder |
| `/shared/:ownerUid` | SharedRegistry | **Public route** — internal auth gate, no BottomNav |
| `/admin` | AdminDashboard | Operator-only — gated by `isAdmin(user)` from `src/admin.js` |
| `/terms` | Terms | Public — renders even when signed out |
| `/privacy` | Privacy | Public — renders even when signed out |

**Public routes** — `/terms`, `/privacy`, and `/shared/:ownerUid` are matched in a top-level public block in `App.jsx`, BEFORE the `!user` auth gate. SharedRegistry runs its own internal auth gate so beneficiaries can land on an invite link without bouncing through the main app's onboarding/login flow.

**Pre-login vs post-login rendering** — when `!user` AND the path isn't a public route, App.jsx renders one of two things outside the `<Routes>` tree:
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
      scannedFromCamera: boolean,
      vendor: string,
      date:   string,                // ISO date YYYY-MM-DD or empty
      amount: number | null,
      notes:  string,
    }
  ],
  interestedParties: [          // beneficiaries who hit "Express Interest"
    // New object shape:
    { uid, name, email, expressedAt },
    // Legacy entries may be bare strings (email or uid). Renderers and
    // hasExpressedInterest()/revoke cleanup both tolerate both shapes.
  ],

  details: {
    condition: 'Excellent' | 'Good' | 'Fair' | 'Poor' | '',
    location:  string,
  },
  ownership: {
    acquisitionType: 'Purchased' | 'Inherited' | 'Gifted' | 'Commissioned' | 'Other' | '',
    acquiredFrom:    string,
    acquiredDate:    string,
    purchasePrice:   number,
  },
  insurance: {
    insurer:        string,
    policyNumber:   string,
    coverageAmount: number,
    lastAppraised:  string,
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
  email: string,                // lowercased
  displayName: string,
  isPremium: boolean,
  onboardingComplete: boolean,
  customCategories: string[],
  createdAt, lastLogin
}
```

### `invites`
Deterministic doc ID format: `{registryOwnerUid}_{lowercased invitedEmail}`. SharedRegistry's verification builds the ID from these two values and looks up the doc directly (no query, no composite index). A fallback `where('registryOwnerUid','==',...) + where('invitedEmail','==',...)` query handles legacy / case-mismatched data.
```
{
  registryOwnerUid: string,
  ownerName: string,
  invitedName: string,
  invitedEmail: string,         // lowercased
  relationship: string,         // Spouse, Child, Sibling, etc.
  status: 'pending' | 'accepted' | 'declined' | 'revoked',
  createdAt, expiresAt,         // expiresAt = createdAt + 30 days
  acceptedAt: timestamp?,       // set when beneficiary first views the registry
  revokedAt: timestamp?,        // set on revoke
  reinstatedAt: timestamp?,     // set when a revoked invite is restored
}
```

### `estateDocs` (Estate Planning Document Center)
```
{
  uid: string,
  categoryId: string,
  title, notes, attorney: string,
  status: 'Current' | 'Draft' | 'Superseded',
  version: string,
  docDate: ISO date,
  filename, fileType: string,
  storagePath, url: string,
  sharedWith: string[],
  uploadedAt, lastReviewed: ISO datetime
}
```

### `mail` (Firebase Trigger Email extension queue)
Writing a doc here sends an email. The extension writes a `delivery` field with the SMTP result. Reads/updates/deletes are blocked for non-admins.
```
{
  to: string | string[],
  message: {
    subject: string,
    html: string
  },
  // delivery: written by the extension after send (success or error)
}
```

### `notifications` (in-app activity feed)
```
{
  ownerUid: string,                                  // recipient — used for read-gate
  type: 'interest_expressed' | 'invite_accepted',
  assetId: string?,                                  // only for interest_expressed
  assetName: string?,                                // only for interest_expressed
  fromName: string,                                  // actor
  fromEmail: string,                                 // actor (used by deletion cleanup)
  read: boolean,
  createdAt: serverTimestamp
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
- An `isAdmin()` helper at the top of the rules hardcodes the same UID as `src/admin.js` (`O7B2SmIf1IW8MC4KqElp6dM4ukG3`). Both must be kept in sync — Firestore rules can't import JS.
- A `hasValidInvite(ownerUid)` helper checks the deterministic invite ID exists AND status is neither `declined` nor `revoked`. Used by the assets read rule.
- `assets`: any authenticated user can `read` if they own it OR have a valid invite (via `hasValidInvite`). Owner OR admin can `write`/`create`. Any authenticated user can `update` if and only if the diff touches **only** the `interestedParties` field (this is how Express Interest works). Owner write covers array rewrites such as the revoke-time interest cleanup.
- `userSettings`: read/update/delete allowed when `resource.data.uid == request.auth.uid` OR `isAdmin()`. Create requires `request.resource.data.uid == request.auth.uid`. The rule checks the **field**, not the document ID.
- `invites`: admin can read all. Owner can CRUD their own invites; invited user can read invites where their email matches `invitedEmail`. Update/delete is owner OR admin.
- `estateDocs`: owner OR admin can read/delete; owner can update; owner can create. Beneficiaries can `read` if their email is in `sharedWith` or if `'__all__'` is in `sharedWith`.
- `mail`: any authenticated user can `create` (this is how invite/notification emails are enqueued). `read`/`update`/`delete` allowed only for admin.
- `notifications`: any authenticated user can `create` (writers don't always own the doc — the actor writes on behalf of the recipient). `read`/`update` allowed only when `resource.data.ownerUid == request.auth.uid`. `delete` allowed only for admin.

**Storage** (`storage.rules`):
- `users/{uid}/{allPaths=**}` — read/write only when `request.auth.uid == uid`. Everything else blocked.

---

## Built features

### Authentication
- Google sign-in (popup)
- Apple sign-in (popup) — **requires Firebase Console + Apple Developer Service ID setup before it works.** Marked "Coming soon" in the UI.
- Email/password sign-in and account creation, with `updateProfile` to set `displayName`
- Friendly error messages mapped from Firebase auth error codes
- **Sign-in lives in three places**: `LoginScreen.jsx` (standalone), the final screen of `Onboarding.jsx` (duplicated inline), and the inline auth gate inside `SharedRegistry.jsx`. All three call the same Firebase auth methods and all three call an `ensureUserSettings` upsert defensively, since App.jsx's auth listener also runs that init.

### Onboarding (first-time users) — pre-login flow
- 4 screens: Welcome ("Your legacy, documented") → Features ("Everything in one place") → Steps ("Getting started is easy") → Sign-in ("You're all set")
- **Shows BEFORE sign-in**, not after. The final screen embeds the social/email sign-in buttons.
- Skip button on screens 2–3 jumps to screen 4. Skipping does NOT bypass login.
- "Use email instead" on screen 4 calls an `onUseEmail` callback in App.jsx, which flips state to render `<LoginScreen initialMode="signin">`
- `localStorage` flag `prov-onboarding-seen` is set on every successful sign-in. Returning signed-out users skip the slides entirely.
- `userSettings.onboardingComplete` is auto-set to `true` for new docs and unconditionally backfilled for legacy accounts.

### Home (Dashboard)
- Header: greeting + day/date on the left; **notification bell button** + avatar on the right. Bell shows a gold dot when unread notifications exist; tapping it smooth-scrolls to the Recent Activity section.
- Estate Readiness card with score (computed across asset count, required estate docs presence, beneficiary count) plus mini pillar buttons.
- Suggested Next Steps (max 3) generated from missing required docs, review-due docs, and beneficiary count.
- **Recent Activity** — between Suggested Next Steps and Your Estate. Renders only when notifications exist. Top 5 sorted desc by `createdAt`. Each row shows the actor and action (`interest_expressed` → "X expressed interest in Y", `invite_accepted` → "X accepted your invitation"), a relative time-ago, a gold unread dot, and a gradient row background while unread. Tapping marks `read: true` (Firestore + local) and navigates to `/asset/:id` or `/profile` depending on type. Query uses `where('ownerUid','==',user.uid)` only; sort + `slice(0,5)` happen client-side to avoid a composite index.
- Your Estate (large pillar grid), Beneficiaries strip, Documents preview, Recently Added Assets, Premium nudge — unchanged from earlier work.

### Registry
- **List view / gallery view toggle** persisted to `localStorage` as `prov-registry-view`.
- **Sort row** with 6 options persisted to `localStorage` as `prov-registry-sort`.
- List view rows are 64×64 thumbnail + name/category/description + value/condition/chevron.
- Gallery view groups assets by category with 2-col `.gallery-grid`.
- Results meta line + total value bar reflect the filtered/sorted set.
- Real-time search and category filter chips compose with sort.
- Archived items filtered client-side.

### Add Asset
- Photo upload at top of form.
- **AI photo identification** via Anthropic API (`claude-sonnet-4-20250514`) returning JSON with name/category/value/description plus four provenance starters.
- Custom category creation persisted to `userSettings.customCategories`.
- Photo uploaded to Firebase Storage at `users/{uid}/assets/{assetId}/photos/hero` after the Firestore doc is created.
- `isPremium = true` hardcoded for AI testing — see **isPremium gating** below.

### Asset Detail Page
- View/edit name, category, value, description (toggle Edit mode).
- Hero image upload with "Change photo".
- **Photos gallery** with 3-column grid, lightbox, hero promotion via `handleAdditionalPhoto`.
- **Documents** attached to the asset, plus the "Scan with Camera" flow that hits Anthropic to extract `documentType`/`title`/`vendor`/`date`/`amount`/`notes`, renders an editable preview, and uploads on save with `scannedFromCamera: true`. Scanned doc rows show a "Scanned" pill and a meta line with money + date when present.
- **Provenance Notes** component with per-section autosave (1.5s debounce) and AI assist gated by `isPremium`.
- **Assigned Beneficiary** accordion — owner can pick from their invites.
- **Interest Expressed** accordion (read-only) — renders only when `asset.interestedParties.length > 0`. Visible in both view and edit mode but never editable. Each row shows `name || email`, an optional `"note"` line, and a locale-formatted `expressedAt` date. Tolerant of both legacy string entries and the new object shape.
- "Move to Archive" instead of permanent delete (sets `itemStatus: 'archived'`).

### Provenance Notes
- 4 sections: Origin / History / Meaning / Legacy.
- Per-category prompt chips drop sentence starters.
- "Help me write" AI button gated by `isPremium`.
- Debounced autosave (1.5s after stop typing).

### Documents (Estate Planning Document Center)
- 10 categories with empty-state guidance text and collapsible sections.
- Per-doc fields: title, version, status (Current/Draft/Superseded), docDate, attorney, notes.
- Annual review tracking with `lastReviewed`, ⚑ flag on docs older than 1 year, banner showing total review-due count.
- **Per-document sharing** via reusable `ShareSettings` panel: Everyone / Specific beneficiaries / Private.
- **Bulk sharing mode** with selection + Share Selected.

### Profile
- Avatar + editable display name (synced to `userSettings.displayName` and Firebase Auth `updateProfile`) + email.
- Plan badge — reads `userSettings?.isPremium || false`.
- **Beneficiaries**:
  - Invite form (name, email, relationship). On create, an `addDoc` enqueues a beneficiary invite email through the Trigger Email extension (subject "X has shared their Provenance registry with you", "Accept Invitation" button linking to the shared URL, with the "you'll need a free Provenance account" note below). Failure of the mail write is swallowed; the invite itself is the critical action.
  - **Expandable rows**: tapping a row toggles a panel showing a status badge with `acceptedAt` date if accepted, and an "Expressed Interest In" list of assets where this beneficiary appears in `interestedParties`. Each asset row navigates to `/asset/:id`. Chevron rotates when open. Copy-link and Revoke / Reinstate / Delete buttons inside the row `stopPropagation` so they don't toggle expansion.
  - **Revoke** updates the invite to `status: 'revoked'` (instead of deleting) and stamps `revokedAt`. It then scans the owner's assets and strips this beneficiary's entries from every `interestedParties` array (tolerant of string/object shapes, case-insensitive). Local `allAssets` mirrors the same cleanup so the panel updates without a reload.
  - **Reinstate** (shown on revoked rows as `.btn-ghost btn-small`) sets `status: 'accepted'`, `revokedAt: null`, `reinstatedAt: serverTimestamp()`, and sends an "access has been restored" email.
  - **Delete** (small red `.invite-delete-link` text link on revoked rows) prompts and hard-`deleteDoc`'s the invite.
- Archive menu row → `/archive`.
- **Admin Dashboard menu row** → `/admin`, visible only when `isAdmin(user)`.
- Appearance section with dark/light theme toggle (persisted to `prov-theme`).
- Legal section (Terms / Privacy).
- Sign out.
- **Delete Account** — `.delete-account-link` reveals confirm panel. Deletion sequence:
  1. `assets` (where `uid == user.uid`)
  2. `userSettings` (matching `uid` field)
  3. `invites` (where `registryOwnerUid == user.uid`)
  4. `estateDocs` (where `uid == user.uid`)
  4a. `invites` where `invitedEmail == lowercased user.email` (beneficiary side)
  4b. `notifications` where `fromEmail == user.email` (actor side; best-effort — self-delete may hit permission-denied per rules, swallowed)
  5. Recursive Storage wipe under `users/{uid}/`
  6. `deleteUser(auth.currentUser)` → `navigate('/')`
  Friendly `auth/requires-recent-login` message; generic error otherwise.

### Archive
- Lists assets where `itemStatus === 'archived'`.
- Reinstate sets status back to active.
- Permanent delete with inline confirmation.

### Beneficiary Invite system
- Owner creates invites in Profile → `invites` collection.
- Invite link format: `https://provenance-510ad.web.app/shared/{ownerUid}` (deterministic).
- Link auto-copied to clipboard on creation; manual "Copy link" button on each row.
- Email delivery handled by the Trigger Email extension (see `mail` collection). Subject and HTML body crafted client-side.

### Shared Registry (`/shared/:ownerUid`)
This is now a **public route** (rendered above the App.jsx auth gate). Every concern below is implemented inside `SharedRegistry.jsx` itself.

- **Inline auth gate** — when `!user`, renders an inline sign-in panel: shield logo (Logo component with `variant="icon"`), Cormorant heading "Sign in to view this registry", subtext, "Continue with Google", OR divider, "Use email instead" toggle that switches to an inline signin/signup form (mirrors `LoginScreen` UX), and a footer note "Only invited beneficiaries can view this registry." All three sign-in handlers call `ensureUserSettings(newUser)` — a defensive upsert that creates a `userSettings` doc if missing (App.jsx's listener does the same, so this is idempotent under normal timing).
- **Wrong account screen** — if a signed-in user has no invite for this registry (`denyReason === 'wrong-account'`), renders "The email address X hasn't been invited to this registry." with a "Sign in with a different account" button that calls `signOut(auth)` and resets local gate state so the next render shows the auth gate again.
- **Strict invite check** — only `pending` and `accepted` invites grant access. Missing doc → `wrong-account`. `revoked` → `revoked`. Other status (e.g. `declined`) → `invalid`.
- **Pending → Accepted flip** — on first successful view of a `pending` invite, the status is updated to `accepted` with `acceptedAt: serverTimestamp()`, the owner gets a "X accepted your Provenance invite" email via the `mail` collection, and an `invite_accepted` notification is written.
- **Real-time revoke** — after the initial check, an `onSnapshot` listener watches the invite doc. If it disappears or flips to `revoked`, the beneficiary is flipped to the deny state immediately. Both the initial-load revoked branch and the listener call the shared `forceSignOut()` helper.
- **`forceSignOut` helper** (module-level) — signs out, then `localStorage.clear()`, `sessionStorage.clear()`, enumerates `indexedDB.databases()` and `deleteDatabase`s any whose name includes `firebase` or `firestore`. Final step navigates via `window.location.href = window.location.href` (not `reload()`) so React re-mounts cleanly. The whole sequence is wrapped in try/catch with the navigate in `finally`.
- **`signingOut` bridge UI** — a state flag set immediately before `forceSignOut()` in both code paths. While true, the component renders a centered shield logo + "Signing out…" against `--surface-0`, suppressing every other render branch so there's no black flash between cache teardown and the re-navigate.
- **Read-only asset cards (tappable)** — entire card is `role="button"` and toggles an `expandedAssetId` state (single-open). Collapsed state shows the existing 72×72 thumbnail / category / name / value / description / additional photo strip plus a `.shared-view-details` link ("View details →") in `--accent-slate`. Inner interactive elements (hero thumbnail lightbox, additional photo strip lightbox, Express Interest button) `stopPropagation` so they don't fight the toggle. Expanded panel (`.shared-asset-expanded`) renders below with: full-width hero photo (4/3, `.shared-expanded-photo` — distinct class from `.shared-asset-photo` to avoid restyling the thumbnail), provenance story blocks (only non-empty `origin`/`history`/`meaning`/`legacy` sections, Cormorant italic gold labels + Inter content), Details (`condition`/`location` when present), Ownership (`acquisitionType`/`acquiredFrom` when present), and a centered "Close" link at the bottom.
- **Express Interest** — button writes to `interestedParties[]` via `arrayUnion` with the new object shape `{ uid, name, email, expressedAt }`. Owner gets an email through `mail` and an `interest_expressed` notification. Button label/disabled state derives per-render from `hasExpressedInterest(asset)` (tolerant of both string and object entry shapes); no separate map state to drift out of sync.
- **Estate Documents section** — shows all docs the owner has shared with this beneficiary (queried with `array-contains-any` against `sharedWith`, filtered by ownerUid client-side to avoid a composite index). Owner viewing their own page sees everything marked shared.
- BottomNav not rendered (the public route block in App.jsx doesn't include the app shell).

### Admin Dashboard (`/admin`)
- Operator-only — gated client-side by `isAdmin(user)`; non-admins silently redirected to `/`.
- Loads all `userSettings`, `assets`, and `invites` (admin-read rules permit this).
- **Users list dedupe** — after loading `userSettings`, filters to one row per `uid` (first occurrence wins). Defensive against duplicate docs caused by races between the various ensureUserSettings/init paths.
- **Stats grid**: total users, total assets, new users (7d), new assets (7d), avg assets/user, total invites.
- **Category breakdown bars** across all assets in the system.
- **Users table** with delete: same Firestore + Storage wipe sequence as Profile self-delete (steps 1–4 + 4a + 4b + 5), skipping step 6 (Firebase Auth account requires Admin SDK). Per-row confirmation panel notes the limitation. `userDoc.email` is used for the beneficiary-invite and actor-notification cleanups.
- **Recent Assets** (last 20) and **Recent Invites** (last 20) tables.
- **System** panel: environment, app version (Vite-injected), admin UID, Anthropic Haiku "Test connection" button.

---

## Email notifications (Trigger Email extension)
Four transactional emails are wired. All are best-effort — failures are logged and swallowed without blocking the underlying action.

| Trigger | Sender code | Subject | Body highlight |
|---|---|---|---|
| Owner creates a beneficiary invite | `Profile.jsx` (after `setDoc` on invites) | "X has shared their Provenance registry with you" | "Accept Invitation" button linking to `/shared/{ownerUid}` |
| Beneficiary first views a pending invite | `SharedRegistry.jsx` (after pending→accepted flip) | "X accepted your Provenance invite" | Plain notification to owner |
| Beneficiary expresses interest | `SharedRegistry.jsx` (after `arrayUnion`) | "X expressed interest in Y" | Card with category + estimated value |
| Owner reinstates a revoked invite | `Profile.jsx` (`handleReinstateInvite`) | "Your access to X's Provenance registry has been restored" | "View Registry" button |

All four follow the same visual template: Provenance wordmark + small-caps eyebrow + Georgia body. They all `addDoc` to `mail` with `{ to, message: { subject, html } }`. The Trigger Email extension writes a `delivery` field with the SMTP result.

---

## In-app notifications
- Stored in the `notifications` collection (see Data model).
- Two types: `interest_expressed` (carries `assetId`/`assetName`) and `invite_accepted`.
- Written from `SharedRegistry.jsx` alongside the corresponding email.
- Read on `Home.jsx` (Recent Activity feed, top 5) and `BottomNav.jsx` (unread dot above the home tab).
- `BottomNav` uses `onSnapshot` on `where('ownerUid','==',user.uid) + where('read','==',false)` so the dot updates the moment the user marks an activity item as read on Home.
- `Home` does a one-shot `getDocs` with `where('ownerUid','==',user.uid)` only — sort + slice happen client-side to avoid a composite index.
- Tap on a Home row marks `read: true` (Firestore + local state) and navigates to `/asset/:id` or `/profile` depending on type.

---

## Anthropic API
- Four call sites:
  1. `ProvenanceNotes.jsx` — "Help me write" writing assist (gated by `isPremium`)
  2. `AddAsset.jsx` — single-photo asset identification (factual fields + provenance starters)
  3. `Components/MultiScanFlow.jsx` — multi-item scan, returns up to 8 items per photo
  4. `AssetDetailPage.jsx` — document camera scan, extracts `documentType`/`title`/`vendor`/`date`/`amount`/`notes` from a receipt/appraisal photo
- `AdminDashboard.jsx` also has a "Test connection" button (uses Haiku).
- API key in `.env` as `VITE_ANTHROPIC_API_KEY`.
- Called directly from the browser with `'anthropic-dangerous-direct-browser-access': 'true'`.
- **The key is bundled into the client JS at build time** — known security trade-off, should be moved behind a server function before serious launch.
- Model: `claude-sonnet-4-20250514` (test ping uses `claude-haiku-4-5-20251001`).

---

## Deployment

Configured in `firebase.json`:
- **Hosting**: serves `dist/`, SPA rewrite to `/index.html`
- **Firestore**: rules from `firestore.rules`
- **Storage**: rules from `storage.rules`

Deploy commands:
```
npm run build && firebase deploy --only hosting       # Web app (default)
firebase deploy --only firestore:rules                # Firestore rules
firebase deploy --only storage                        # Storage rules
firebase deploy                                       # Everything
```

---

## isPremium gating

- `Profile.jsx`: reads `userSettings?.isPremium || false` — wired correctly to Firestore. The Admin Dashboard's plan toggle writes to the same field.
- `AddAsset.jsx`: still has `const isPremium = true` hardcoded — needs to come from the prop App.jsx already passes.
- `AssetDetailPage.jsx`: still passes `isPremium={false}` to `<ProvenanceNotes>` — needs to come from `userSettings`.
- App.jsx loads `isPremium` from `userSettings` on init and stores it; it already passes it down to `<AddAsset>` and `<Reports>` as a prop, but the inner component overrides.

Per the standing instructions at the top of this file: when wiring payments, finish removing the hardcoded values.

---

## Known issues / TODOs

- **`Reports.jsx` is still a placeholder.** No reports built yet.
- **`AssetDetail.jsx` (root, not in pages/) is dead code.** Replaced by `pages/AssetDetailPage.jsx`. Safe to delete.
- **Apple sign-in won't work until configured in Firebase Console.** Need an Apple Developer account, a Service ID, the domain registered, and Apple enabled in Firebase Auth → Sign-in method.
- **`isPremium` is partially hardcoded** in AddAsset and AssetDetailPage — see "isPremium gating" above.
- **`VITE_ANTHROPIC_API_KEY` is in the client bundle** — known security trade-off.
- **`additionalImages` array can contain a mix of types** — legacy entries are plain base64 strings, new entries are `{url, storagePath}` objects.
- **`interestedParties` may also contain mixed shapes** — legacy bare strings (uid or email) and new `{uid, name, email, expressedAt}` objects. Every renderer / matcher / cleanup path handles both.
- **`userSettings` collection mixes patterns**: most reads/writes use `addDoc` + `where('uid', '==', ...)`. The rule checks the `uid` field, not the doc ID.
- **Race risk on userSettings creation** — `SharedRegistry`'s auth-gate `ensureUserSettings` and `App.jsx`'s init effect both `addDoc` after sign-in. If the two getDocs fire concurrently they both see empty and both write, creating a duplicate doc. Admin Dashboard's by-uid dedupe filters the UI side; Firestore still ends up with two rows. Acceptable for now.
- **Admin can't *read* notifications from another user's feed** — rules allow read only when `resource.data.ownerUid == request.auth.uid`. Admin can `delete` (Fix 5 in the security pass) and any deletion cleanup that runs as admin will succeed on docs it can target, but the existing query in admin/self deletion (`where('fromEmail', '==', deletedUserEmail)`) doesn't constrain by ownerUid and will permission-deny under both roles. Both code paths swallow the error. Tighten this if real cleanup-as-admin becomes important.
- **`indexedDB.databases()` is unsupported on Firefox.** `forceSignOut` catches the throw in its try block and the `finally` still re-navigates — Firefox users get "signed out + storage cleared + reloaded" but no IndexedDB wipe.
- **Firestore composite indexes**: queries that combine two `where` clauses on different fields generally require composite indexes. The shared estate docs query and the Home notifications query both avoid this by querying on one field and sorting/filtering client-side.
- **Admin "Delete user" cannot remove the Firebase Auth account** from the browser — requires the Admin SDK. Confirmation panel says so; remove the Auth row from Firebase Console → Authentication to fully purge a test user.
- **MultiScanFlow does not save the source photo to scanned items** — created assets get `imageUrl: ''`. Worth wiring later if scanned items should carry the source photo.
