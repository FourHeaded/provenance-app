import { useState, useEffect } from 'react'
import { auth, googleProvider, db } from './firebase'
import { signInWithPopup, signOut } from 'firebase/auth'
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore'
import './App.css'

function App() {
  const [user, setUser] = useState(null)
  const [assets, setAssets] = useState([])
  const [form, setForm] = useState({ name: '', category: '', description: '', value: '' })

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      if (currentUser) {
        setUser(currentUser)
        loadAssets(currentUser.uid)
      }
    })
    return () => unsubscribe()
  }, [])
  
  const loadAssets = async (uid) => {
    const q = query(collection(db, 'assets'), where('uid', '==', uid))
    const snapshot = await getDocs(q)
    setAssets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
  }

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
      <div>
        <h1>Provenance</h1>
        <p>Track and pass down what matters.</p>
        <button onClick={handleLogin}>Sign in with Google</button>
      </div>
    )
  }

  return (
    <div>
      <h1>Provenance</h1>
      <p>Welcome, {user.displayName}</p>
      <button onClick={handleLogout}>Sign Out</button>

      <h2>Add an Asset</h2>
      <form onSubmit={handleSubmit}>
        <input name="name" placeholder="Item name" value={form.name} onChange={handleChange} required />
        <input name="category" placeholder="Category" value={form.category} onChange={handleChange} />
        <input name="description" placeholder="Description" value={form.description} onChange={handleChange} />
        <input name="value" placeholder="Estimated value" value={form.value} onChange={handleChange} />
        <button type="submit">Add Asset</button>
      </form>

      <h2>Your Assets</h2>
      {assets.length === 0 ? (
        <p>No assets yet.</p>
      ) : (
        assets.map((asset) => (
          <div key={asset.id}>
            <strong>{asset.name}</strong> — {asset.category} — ${asset.value}
            <p>{asset.description}</p>
          </div>
        ))
      )}
    </div>
  )
}

export default App