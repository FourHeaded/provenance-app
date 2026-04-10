import { useState, useEffect } from 'react'
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { auth, db } from './firebase'
import { updateProfile } from 'firebase/auth'
import { collection, addDoc, getDocs, query, where, doc, updateDoc } from 'firebase/firestore'
import AssetDetailPage from './pages/AssetDetailPage'
import BottomNav from './components/BottomNav'
import Home from './pages/Home'
import Registry from './pages/Registry'
import AddAsset from './pages/AddAsset'
import Documents from './pages/Documents'
import Profile from './pages/Profile'
import Archive from './pages/Archive'
import Reports from './pages/Reports'
import SharedRegistry from './pages/SharedRegistry'
import Onboarding from './pages/Onboarding'
import LoginScreen from './pages/LoginScreen'
import AdminDashboard from './pages/AdminDashboard'
import Terms from './pages/Terms'
import Privacy from './pages/Privacy'
import './App.css'

function App() {
  const [user, setUser]                       = useState(null)
  const [authReady, setAuthReady]             = useState(false)
  const [onboardingChecked, setOnboardingChecked] = useState(false)
  const [showOnboarding, setShowOnboarding]   = useState(false)
  const [isPremium, setIsPremium]             = useState(false)
  // When the user is signed-out and taps "Use email instead" on the
  // pre-login Onboarding flow, swap to LoginScreen so they can use the
  // standalone email form. Resets on sign-out so the Onboarding flow
  // restarts cleanly for the next signed-out session.
  const [showLogin, setShowLogin]             = useState(false)
  const [theme, setTheme]                     = useState(() => localStorage.getItem('prov-theme') || 'dark')
  const location = useLocation()
  const navigate = useNavigate()

  // Apply theme to <html> and persist
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('prov-theme', theme)
  }, [theme])

  // Auth listener
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser)
      setAuthReady(true)
      if (!currentUser) {
        setOnboardingChecked(false)
        setShowOnboarding(false)
        setShowLogin(false)
      } else {
        // Successful sign-in: this user has now seen the pre-login
        // onboarding (either by walking through screens 1-4, or by
        // signing in via the minimal LoginScreen). Persist the flag
        // so future signed-out visits skip the slides.
        try {
          localStorage.setItem('prov-onboarding-seen', 'true')
        } catch {
          // localStorage may be unavailable in some sandboxed contexts
        }
      }
      // Post-login redirect for shared links
      if (currentUser) {
        const redirect = sessionStorage.getItem('pendingRedirect')
        if (redirect) {
          sessionStorage.removeItem('pendingRedirect')
          navigate(redirect, { replace: true })
        }
      }
    })
    return () => unsubscribe()
  }, [])

  // Initialize user settings doc + check onboarding status whenever user changes
  useEffect(() => {
    if (!user) return
    const initialize = async () => {
      try {
        const snap = await getDocs(query(
          collection(db, 'userSettings'),
          where('uid', '==', user.uid),
        ))

        // Profile fields refreshed on every sign-in (so admin sees latest)
        const profileFields = {
          uid: user.uid,
          displayName: user.displayName || '',
          email: (user.email || '').toLowerCase(),
          lastLogin: new Date().toISOString(),
        }

        let complete = false

        if (snap.empty) {
          // New user — create initial settings doc. In the new flow the
          // user has already walked through the pre-login onboarding, so
          // mark it complete on creation to avoid showing it twice.
          await addDoc(collection(db, 'userSettings'), {
            ...profileFields,
            createdAt: new Date().toISOString(),
            isPremium: false,
            onboardingComplete: true,
          })
          complete = true
          setIsPremium(false)
        } else {
          const existing = snap.docs[0]
          const data = existing.data()
          complete = data.onboardingComplete === true
          setIsPremium(data.isPremium === true)

          // If the user has set a custom display name in their settings,
          // sync it back to Firebase Auth so user.displayName reflects it
          // across sessions (Home greeting, Profile fallback, etc.)
          if (data.displayName && data.displayName !== user.displayName) {
            try {
              await updateProfile(auth.currentUser, { displayName: data.displayName })
              // updateProfile mutates auth.currentUser in place; spread to a
              // new object so React sees a fresh reference and re-renders.
              setUser({ ...auth.currentUser })
            } catch (e) {
              console.error('Failed to sync display name from settings:', e)
            }
          }

          // Backfill createdAt for legacy users that never had one
          const updates = { ...profileFields }
          if (!data.createdAt) updates.createdAt = new Date().toISOString()
          // Don't clobber a custom displayName with the auth value —
          // userSettings is the source of truth once the user has set one.
          if (data.displayName) {
            delete updates.displayName
          }

          // If onboarding hasn't been marked complete, double-check whether
          // this is actually a new user. Legacy users from before the
          // onboarding flow exists never had the flag set, so we'd show
          // them the "add your first asset" prompt every sign-in even
          // though they already have a full registry.
          //
          // We only run this asset query when the flag is missing, so it
          // executes at most once per user — after we persist
          // onboardingComplete: true, future sign-ins skip the check.
          if (!complete) {
            const assetSnap = await getDocs(query(
              collection(db, 'assets'),
              where('uid', '==', user.uid),
            ))
            const hasAssets = assetSnap.docs
              .some(d => d.data().itemStatus !== 'archived')
            if (hasAssets) {
              complete = true
              updates.onboardingComplete = true
            }
          }

          // In the new flow, every signed-in user has already been
          // through the pre-login onboarding, so any account that
          // somehow still lacks the flag should be backfilled. This
          // prevents the (now-vestigial) post-login Onboarding block
          // below from ever rendering for a logged-in user.
          if (!complete) {
            complete = true
            updates.onboardingComplete = true
          }

          await updateDoc(doc(db, 'userSettings', existing.id), updates)
        }

        setShowOnboarding(!complete)
      } catch (e) {
        // Permissions error or any other failure — treat as new user, show onboarding
        console.error('User init failed:', e)
        setShowOnboarding(true)
      } finally {
        setOnboardingChecked(true)
      }
    }
    initialize()
  }, [user?.uid])

  // Waiting for Firebase
  if (!authReady) return null

  // Public legal pages — accessible whether or not the user is signed in
  if (location.pathname === '/terms' || location.pathname === '/privacy') {
    return (
      <Routes>
        <Route path="/terms"   element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
      </Routes>
    )
  }

  // Not signed in
  if (!user) {
    const isSharedPath = location.pathname.startsWith('/shared/')
    const hasSeenOnboarding = (() => {
      try { return !!localStorage.getItem('prov-onboarding-seen') } catch { return false }
    })()

    // Returning users (already seen the slides) and users who tapped
    // "Use email instead" go straight to LoginScreen. Everyone else
    // walks through the new pre-login Onboarding flow.
    if (showLogin || hasSeenOnboarding) {
      return (
        <LoginScreen
          isSharedPath={isSharedPath}
          pendingPath={location.pathname}
          initialMode={showLogin ? 'signin' : undefined}
        />
      )
    }

    return (
      <Onboarding
        isSharedPath={isSharedPath}
        pendingPath={location.pathname}
        onUseEmail={() => setShowLogin(true)}
      />
    )
  }

  // Signed in but still checking onboarding state
  if (!onboardingChecked) return null

  // First-time user
  if (showOnboarding) {
    return <Onboarding user={user} onComplete={() => setShowOnboarding(false)} />
  }

  // Normal app
  const isSharedRoute = location.pathname.startsWith('/shared/')

  return (
    <div className="app-shell">
      <div className="page-content">
        <Routes>
          <Route path="/"                    element={<Home user={user} />} />
          <Route path="/registry"            element={<Registry user={user} />} />
          <Route path="/add"                 element={<AddAsset user={user} isPremium={isPremium} />} />
          <Route path="/documents"           element={<Documents user={user} />} />
          <Route path="/profile"             element={<Profile user={user} theme={theme} setTheme={setTheme} />} />
          <Route path="/archive"             element={<Archive user={user} />} />
          <Route path="/asset/:id"           element={<AssetDetailPage />} />
          <Route path="/reports"             element={<Reports user={user} isPremium={isPremium} />} />
          <Route path="/shared/:ownerUid"    element={<SharedRegistry user={user} />} />
          <Route path="/admin"               element={<AdminDashboard user={user} />} />
        </Routes>
      </div>
      {!isSharedRoute && <BottomNav />}
    </div>
  )
}

export default App
