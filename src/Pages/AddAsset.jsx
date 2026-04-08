import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../firebase'
import { collection, addDoc, getDocs, query, where, doc, updateDoc } from 'firebase/firestore'
import { PRESET_CATEGORIES } from '../categories'

function AddAsset({ user }) {
  const [form, setForm] = useState({ name: '', category: '', description: '', value: '' })
  const [customCategories, setCustomCategories] = useState([])
  const [customCategoryInput, setCustomCategoryInput] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const navigate = useNavigate()

  const allCategories = [...PRESET_CATEGORIES, ...customCategories]

  useEffect(() => {
    const loadCustomCategories = async () => {
      const q = query(collection(db, 'userSettings'), where('uid', '==', user.uid))
      const snapshot = await getDocs(q)
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data()
        setCustomCategories(data.customCategories || [])
      }
    }
    loadCustomCategories()
  }, [])

  const saveCustomCategories = async (categories) => {
    const q = query(collection(db, 'userSettings'), where('uid', '==', user.uid))
    const snapshot = await getDocs(q)
    if (snapshot.empty) {
      await addDoc(collection(db, 'userSettings'), { uid: user.uid, customCategories: categories })
    } else {
      await updateDoc(doc(db, 'userSettings', snapshot.docs[0].id), { customCategories: categories })
    }
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
    await saveCustomCategories(updated)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const newAsset = { ...form, uid: user.uid }
    await addDoc(collection(db, 'assets'), newAsset)
    setForm({ name: '', category: '', description: '', value: '' })
    setShowCustomInput(false)
    navigate('/registry')
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Add an Asset</h1>
      </div>

      <div className="form-section">
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
    </div>
  )
}

export default AddAsset