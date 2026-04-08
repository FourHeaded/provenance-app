import { useState, useEffect } from 'react'
import { auth, googleProvider, db } from './firebase'
import { signInWithPopup, signOut } from 'firebase/auth'
import { collection, addDoc, getDocs, query, where, doc, updateDoc } from 'firebase/firestore'
import AssetDetail from './AssetDetail'
import { PRESET_CATEGORIES } from './categories'
import './App.css'

function App() {
  const [user, setUser] = useState(null)
  const [assets, setAssets] = useState([])
  const [form, setForm] = useState({ name: '', category: '', description: '', value: '' })
  const [selectedAsset, setSelectedAsset] = useState(null)
  const [customCategories, setCustomCategories] = useState([])
  const [customCategoryInput, setCustomCategoryInput] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [activeFilters, setActiveFilters] = useState([])

  const allCategories = [...PRESET_CATEGORIES, ...customCategories]

  const loadAssets = async (uid) => {
    const q = query(collection(db, 'assets'), where('uid', '==', uid))
    const snapshot = await getDocs(q)
    setAssets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
  }

  const loadCustomCategories = async (uid) => {
    const q = query(collection(db, 'userSettings'), where('uid', '==', uid))
    const snapshot = await getDocs(q)
    if (!snapshot.empty) {
      const data = snapshot.docs[0].data()
      setCustomCategories(data.customCategories || [])
    }
  }

  const saveCustomCategories = async (uid, categories) => {
    const q = query(collection(db, 'userSettings'), where('uid', '==', uid))
    const snapshot = await getDocs(q)
    if (snapshot.empty) {
      await addDoc(collection(db, 'userSettings'), { uid, customCategories: categories })
    } else {
      await updateDoc(doc(db, 'userSettings', snapshot.docs[0].id), { customCategories: categories })
    }
  }

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      if (currentUser) {
        setUser(currentUser)
        loadAssets(currentUser.uid)
        loadCustomCategories(currentUser.uid)
      }
    })
    return () => unsubscribe()
  }, [])

  const handleLogin = async () => {
    const result = await signInWithPopup(auth, googleProvider)
    setUser(result.user)
    loadAssets(result.user.uid)
    loadCustomCategories(result.user.uid)
  }

  const handleLogout = async () => {
    await signOut(auth)
    setUser(null)
    setAssets([])
    setSelectedAsset(null)
    setActiveFilters([])
  }

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleCategorySelect = (category) => {
    if (category === 'custom') {
      setShowCustomInput(true)
      return
    }
    setForm({ ...form, category })
    setShowCustomInput(false)
  }

  const handleAddCustomCategory = async () => {
    const trimmed = customCategoryInput.trim()
    if (!trimmed || allCategories.includes(trimmed)) return
    const updated = [...customCategories, trimmed]
    setCustomCategories(updated)
    setForm({ ...form, category: trimmed })
    setCustomCategoryInput('')
    setShowCustomInput(false)
    await saveCustomCategories(user.uid, updated)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const newAsset = { ...form, uid: user.uid }
    const docRef = await addDoc(collection(db, 'assets'), newAsset)
    setAssets([...assets, { id: docRef.id, ...newAsset }])
    setForm({ name: '', category: '', description: '', value: '' })
    setShowCustomInput(false)
  }

  const toggleFilter = (category) => {
    setActiveFilters(prev =>
      prev.includes(category)
        ? prev.filter(f => f !== category)
        : [...prev, category]
    )
  }

  const usedCategories = [...new Set(assets.map(a => a.category).filter(Boolean))]

  const filteredAssets = activeFilters.length === 0
    ? assets
    : assets.filter(a => activeFilters.includes(a.category))

  if (selectedAsset) {
    return (
      <AssetDetail
        asset={selectedAsset}
        onBack={() => setSelectedAsset(null)}
        onUpdate={(updated) => {
          setSelectedAsset(updated)
          setAssets(assets.map(a => a.id === updated.id ? updated : a))
        }}
        onDelete={(id) => {
          setAssets(assets.filter(a => a.id !== id))
          setSelectedAsset(null)
        }}
      />
    )
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
          <input
            name="name"
            placeholder="Item name"
            value={form.name}
            onChange={handleChange}
            required
            className="full-width"
          />

          <div className="category-selector full-width">
            <div className="category-chips">
              {allCategories.map(cat => (
                <button
                  type="button"
                  key={cat}
                  className={`category-chip ${form.category === cat ? 'active' : ''}`}
                  onClick={() => handleCategorySelect(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="category-chip category-chip-add"
              onClick={() => handleCategorySelect('custom')}
            >
              + Add Custom Category
            </button>
            {showCustomInput && (
              <div className="custom-category-input">
                <input
                  placeholder="Category name"
                  value={customCategoryInput}
                  onChange={e => setCustomCategoryInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddCustomCategory())}
                  autoFocus
                />
                <button type="button" className="btn-ghost" onClick={handleAddCustomCategory}>Add</button>
              </div>
            )}
            {form.category && (
              <div className="selected-category">
                Selected: <strong>{form.category}</strong>
              </div>
            )}
          </div>

          <input
            name="value"
            placeholder="Estimated value"
            value={form.value}
            onChange={handleChange}
            className="full-width"
          />
          <input
            name="description"
            placeholder="Description"
            value={form.description}
            onChange={handleChange}
            className="full-width"
          />
          <button type="submit" className="btn-primary">Add to Registry</button>
        </form>
      </div>

      <div className="asset-list">
        <h2 className="section-label">Registry</h2>

        {usedCategories.length > 0 && (
          <div className="filter-bar">
            {usedCategories.map(cat => (
              <button
                key={cat}
                className={`filter-chip ${activeFilters.includes(cat) ? 'active' : ''}`}
                onClick={() => toggleFilter(cat)}
              >
                {cat}
              </button>
            ))}
            {activeFilters.length > 0 && (
              <button className="filter-clear" onClick={() => setActiveFilters([])}>
                Clear
              </button>
            )}
          </div>
        )}

        <hr className="divider" />

        {filteredAssets.length === 0 ? (
          <p className="empty-state">
            {activeFilters.length > 0 ? 'No assets match the selected filters.' : 'No assets recorded yet.'}
          </p>
        ) : (
          filteredAssets.map((asset) => (
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