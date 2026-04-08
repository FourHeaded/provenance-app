import { useState, useEffect } from 'react'
import AssetDetailPage from './pages/AssetDetailPage'
import { Routes, Route } from 'react-router-dom'
import { auth, googleProvider } from './firebase'
import { signInWithPopup } from 'firebase/auth'
import BottomNav from './components/BottomNav'
import Home from './pages/Home'
import Registry from './pages/Registry'
import AddAsset from './pages/AddAsset'
import Documents from './pages/Documents'
import Profile from './pages/Profile'
import Archive from './pages/Archive'
import Reports from './pages/Reports'
import './App.css'

function App() {
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser)
      setAuthReady(true)
    })
    return () => unsubscribe()
  }, [])

  const handleLogin = async () => {
    await signInWithPopup(auth, googleProvider)
  }

  if (!authReady) return null

  if (!user) {
    return (
      <div className="login-screen">
        <div className="login-ornament"></div>
        <h1>Provenance</h1>
        <div className="login-ornament"></div>
        <p className="login-tagline">Track and pass down what matters.</p>
        <button className="btn-primary" onClick={handleLogin}>Sign in with Google</button>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <div className="page-content">
        <Routes>
          <Route path="/" element={<Home user={user} />} />
          <Route path="/registry" element={<Registry user={user} />} />
          <Route path="/add" element={<AddAsset user={user} />} />
          <Route path="/documents" element={<Documents user={user} />} />
          <Route path="/profile" element={<Profile user={user} />} />
          <Route path="/archive" element={<Archive user={user} />} />
          <Route path="/asset/:id" element={<AssetDetailPage />} />
          <Route path="/reports" element={<Reports user={user} />} />
        </Routes>
      </div>
      <BottomNav />
    </div>
  )
}

export default App