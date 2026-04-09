import { useState, useEffect } from 'react'
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { auth, db } from './firebase'
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
          // New user — create initial settings doc
          await addDoc(collection(db, 'userSettings'), {
            ...profileFields,
            createdAt: new Date().toISOString(),
            isPremium: false,
          })
          setIsPremium(false)
        } else {
          const existing = snap.docs[0]
          const data = existing.data()
          complete = data.onboardingComplete === true
          setIsPremium(data.isPremium === true)
          // Backfill createdAt for legacy users that never had one
          const updates = { ...profileFields }
          if (!data.createdAt) updates.createdAt = new Date().toISOString()

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
    return (
      <LoginScreen
        isSharedPath={location.pathname.startsWith('/shared/')}
        pendingPath={location.pathname}
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
          <Route path="/add"                 element={<AddAsset user={user} />} />
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
