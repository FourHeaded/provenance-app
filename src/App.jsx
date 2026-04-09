import { useState, useEffect } from 'react'
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { auth, googleProvider, db } from './firebase'
import { signInWithPopup } from 'firebase/auth'
import { collection, getDocs, query, where } from 'firebase/firestore'
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
import './App.css'

function App() {
  const [user, setUser]                       = useState(null)
  const [authReady, setAuthReady]             = useState(false)
  const [onboardingChecked, setOnboardingChecked] = useState(false)
  const [showOnboarding, setShowOnboarding]   = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

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

  // Check onboarding status whenever user changes
  useEffect(() => {
    if (!user) return
    const check = async () => {
      try {
        const snap = await getDocs(query(
          collection(db, 'userSettings'),
          where('uid', '==', user.uid),
        ))
        const complete = !snap.empty && snap.docs[0].data().onboardingComplete === true
        setShowOnboarding(!complete)
      } catch {
        // Permissions error or any other failure — treat as new user, show onboarding
        setShowOnboarding(true)
      } finally {
        setOnboardingChecked(true)
      }
    }
    check()
  }, [user?.uid])

  const handleLogin = async () => {
    const path = location.pathname
    if (path.startsWith('/shared/')) {
      sessionStorage.setItem('pendingRedirect', path)
    }
    await signInWithPopup(auth, googleProvider)
  }

  // Waiting for Firebase
  if (!authReady) return null

  // Not signed in
  if (!user) {
    const isSharedPath = location.pathname.startsWith('/shared/')
    return (
      <div className="login-screen">
        <div className="login-ornament" />
        <h1>Provenance</h1>
        <div className="login-ornament" />
        <p className="login-tagline">Track and pass down what matters.</p>
        {isSharedPath && (
          <p className="login-shared-hint">Sign in to view the shared registry.</p>
        )}
        <button className="btn-primary" onClick={handleLogin}>Sign in with Google</button>
      </div>
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
          <Route path="/profile"             element={<Profile user={user} />} />
          <Route path="/archive"             element={<Archive user={user} />} />
          <Route path="/asset/:id"           element={<AssetDetailPage />} />
          <Route path="/reports"             element={<Reports user={user} />} />
          <Route path="/shared/:ownerUid"    element={<SharedRegistry user={user} />} />
        </Routes>
      </div>
      {!isSharedRoute && <BottomNav />}
    </div>
  )
}

export default App
