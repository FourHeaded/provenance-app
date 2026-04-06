import { useState, useEffect } from 'react'
import { auth, googleProvider, db } from './firebase'
import { signInWithPopup, signOut } from 'firebase/auth'
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore'
import AssetDetail from './AssetDetail'
import './App.css'

function App() {
  const [user, setUser] = useState(null)
  const [assets, setAssets] = useState([])
  const [form, setForm] = useState({ name: '', category: '', description: '', value: '' })
  const [selectedAsset, setSelectedAsset] = useState(null)

  const loadAssets = async (uid) => {
    const q = query(collection(db, 'assets'), where('uid', '==', uid))
    const snapshot = await getDocs(q)
    setAssets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
  }

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      if (currentUser) {
        setUser(currentUser)
        loadAssets(currentUser.uid)
      }
    })
    return () => unsubscribe()
  }, [])

  const handleLogin = async () => {
    const result = await signInWithPopup(auth, googleProvider)
    setUser(result.user)
    loadAssets(result.user.uid)
  }

  const handleLogout = async () => {
    await signOut(auth)
    setUser(null)
    setAssets([])
    setSelectedAsset(null)
  }

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const newAsset = { ...form, uid: user.uid }
    const docRef = await addDoc(collection(db, 'assets'), newAsset)
    setAssets([...assets, { id: docRef.id, ...newAsset }])
    setForm({ name: '', category: '', description: '', value: '' })
  }

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

  if (selectedAsset) {
    return (
      <AssetDetail
        asset={selectedAsset}
        onBack={() => setSelectedAsset(null)}
        onUpdate={(updated) => {
          setSelectedAsset(updated)
          setAssets(assets.map(a => a.id === updated.id ? updated : a))
        }}
      />
    )
  }

  return (
    <div className="app">
      <div className="header">
        <div className="header-top">
          <div className="header-brand">
            <h1>Provenance</h1>
            <p>Estate Asset Registry</p>
          </div>
          <button className="btn-ghost" onClick={handleLogout}>Sign Out</button>
        </div>
        <div className="header-meta">
          <span className="welcome">{user.displayName}</span>
        </div>
      </div>

      <div className="form-section">
        <h2 className="section-label">Add an Asset</h2>
        <form className="asset-form" onSubmit={handleSubmit}>
          <input name="name" placeholder="Item name" value={form.name} onChange={handleChange} required className="full-width" />
          <input name="category" placeholder="Category" value={form.category} onChange={handleChange} />
          <input name="value" placeholder="Estimated value" value={form.value} onChange={handleChange} />
          <input name="description" placeholder="Description" value={form.description} onChange={handleChange} className="full-width" />
          <button type="submit" className="btn-primary">Add to Registry</button>
        </form>
      </div>

      <div className="asset-list">
        <h2 className="section-label">Registry</h2>
        <hr className="divider" />
        {assets.length === 0 ? (
          <p className="empty-state">No assets recorded yet.</p>
        ) : (
          assets.map((asset) => (
            <div className="asset-card" key={asset.id} onClick={() => setSelectedAsset(asset)}>
              <div className="asset-card-left">
                <div className="asset-name">{asset.name}</div>
                <div className="asset-category">{asset.category}</div>
                {asset.description && <div className="asset-description">{asset.description}</div>}
              </div>
              <div className="asset-card-right">
                <span className="asset-value">${asset.value}</span>
                <span className="asset-chevron">›</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default App