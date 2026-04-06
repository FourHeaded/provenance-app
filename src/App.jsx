import { useState, useEffect } from 'react'
import { auth, googleProvider, db } from './firebase'
import { signInWithPopup, signOut } from 'firebase/auth'
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore'
import './App.css'

function App() {
  const [user, setUser] = useState(null)
  const [assets, setAssets] = useState([])
  const [form, setForm] = useState({ name: '', category: '', description: '', value: '' })

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
        <h1>Provenance</h1>
        <p>Track and pass down what matters.</p>
        <button className="btn-primary" onClick={handleLogin}>Sign in with Google</button>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="header">
        <h1>Provenance</h1>
        <p>Estate Asset Registry</p>
        <div className="header-meta">
          <span className="welcome">{user.displayName}</span>
          <button className="btn-ghost" onClick={handleLogout}>Sign Out</button>
        </div>
      </div>

      <div className="form-section">
        <h2>Add an Asset</h2>
        <form className="asset-form" onSubmit={handleSubmit}>
          <input name="name" placeholder="Item name" value={form.name} onChange={handleChange} required className="full-width" />
          <input name="category" placeholder="Category" value={form.category} onChange={handleChange} />
          <input name="value" placeholder="Estimated value" value={form.value} onChange={handleChange} />
          <input name="description" placeholder="Description" value={form.description} onChange={handleChange} className="full-width" />
          <button type="submit" className="btn-primary">Add to Registry</button>
        </form>
      </div>

      <div className="asset-list">
        <h2>Registry</h2>
        {assets.length === 0 ? (
          <p className="empty-state">No assets recorded yet.</p>
        ) : (
          assets.map((asset) => (
            <div className="asset-card" key={asset.id}>
              <div className="asset-card-header">
                <span className="asset-name">{asset.name}</span>
                <span className="asset-value">${asset.value}</span>
              </div>
              <div className="asset-category">{asset.category}</div>
              <div className="asset-description">{asset.description}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default App