import { useState } from 'react'
import { auth, googleProvider } from './firebase'
import { signInWithPopup, signOut } from 'firebase/auth'
import './App.css'

function App() {
  const [user, setUser] = useState(null)
  const [assets, setAssets] = useState([])
  const [form, setForm] = useState({ name: '', category: '', description: '', value: '' })

  const handleLogin = async () => {
    const result = await signInWithPopup(auth, googleProvider)
    setUser(result.user)
  }

  const handleLogout = async () => {
    await signOut(auth)
    setUser(null)
  }

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setAssets([...assets, form])
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
        assets.map((asset, i) => (
          <div key={i}>
            <strong>{asset.name}</strong> — {asset.category} — ${asset.value}
            <p>{asset.description}</p>
          </div>
        ))
      )}
    </div>
  )
}

export default App