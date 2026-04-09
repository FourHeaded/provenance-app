# Provenance App

## What this is
A premium estate asset registry app. Users catalog valuable personal items, document their stories, and plan inheritance. Built with React + Vite + Firebase.

## Tech stack
- React (Vite)
- Firebase Auth (Google sign-in)
- Firestore (database)
- React Router v6
- Custom CSS (no Tailwind)

## Design system
- Dark mode only currently
- Fonts: Playfair Display (headings/serif), Inter (body)
- Colors: --accent-gold: #D4A94E, --surface-0: #0D0D0D, --surface-1: #1A1A1A
- All styles in src/App.css and src/ProvenanceNotes.css

## File structure
- src/pages/ — page components (Home, Registry, AddAsset, Documents, Profile, Archive, Reports)
- src/components/ — BottomNav
- src/firebase.js — Firebase config and exports
- src/categories.js — preset category list
- src/provenancePrompts.js — AI prompt chips by category
- src/ProvenanceNotes.jsx — notes component with AI assist
- src/AssetDetail.jsx — legacy detail component (being replaced by pages/AssetDetailPage.jsx)

## Current state
Navigation shell is complete with bottom nav (Home, Registry, +Add, Documents, Profile).
Home dashboard shows total assets, total value, category breakdown, recent assets.
Registry shows asset list with category filtering.
Add Asset has full form with category chips and custom categories.
Asset Detail has edit, delete, photo upload, provenance notes with AI prompt chips.

## What to build next
1. Profile page — user info, sign out, premium status indicator
2. Archive system — soft delete, archive page, reinstate or permanent delete
3. Deploy to Firebase Hosting

## Anthropic API
Used for AI writing assist in ProvenanceNotes.jsx.
API key is in .env as VITE_ANTHROPIC_API_KEY.
Never hardcode the key.

## isPremium
Currently hardcoded to false everywhere. Premium gating is built in but not wired to payments yet.