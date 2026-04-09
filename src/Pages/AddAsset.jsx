import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, storage } from '../firebase'
import { collection, addDoc, getDocs, query, where, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { PRESET_CATEGORIES } from '../categories'
import PhotoUploadButtons from '../components/PhotoUploadButtons'
import MultiScanFlow from '../components/MultiScanFlow'
import '../ProvenanceNotes.css'

const NOTE_SECTIONS = [
  { key: 'origin',  label: 'Origin',  placeholder: 'Where did this come from?' },
  { key: 'history', label: 'History', placeholder: 'What has this been through?' },
  { key: 'meaning', label: 'Meaning', placeholder: 'Why does this matter?' },
  { key: 'legacy',  label: 'Legacy',  placeholder: 'Who should have this, and what should they know?' },
]

// Mirrors the constants in AssetDetailPage so the create and edit
// flows show identical pill rows for the new field groups.
const CONDITION_OPTIONS   = ['Excellent', 'Good', 'Fair', 'Poor', 'Unknown']
const ACQUISITION_OPTIONS = ['Purchased', 'Inherited', 'Gifted', 'Commissioned', 'Other']

function priceLabel(acquisitionType) {
  return acquisitionType === 'Inherited' || acquisitionType === 'Gifted'
    ? 'Appraised at acquisition'
    : 'Purchase price'
}

function numericOrEmpty(v) {
  if (v === '' || v == null) return ''
  const n = parseFloat(v)
  return isNaN(n) ? '' : n
}

function summarize(parts) {
  return parts.filter(Boolean).join(' · ')
}

function AddAsset({ user, isPremium = false }) {
  const [form, setForm] = useState({ name: '', category: '', description: '', value: '' })
  const [notes, setNotes] = useState({ origin: '', history: '', meaning: '', legacy: '' })
  const [details, setDetails] = useState({ condition: '', location: '' })
  const [ownership, setOwnership] = useState({
    acquisitionType: '',
    acquiredFrom:    '',
    acquiredDate:    '',
    purchasePrice:   '',
  })
  const [insurance, setInsurance] = useState({
    insurer:        '',
    policyNumber:   '',
    coverageAmount: '',
    lastAppraised:  '',
    appraisedBy:    '',
  })
  const [openSections, setOpenSections] = useState({
    details:   false,
    ownership: false,
    insurance: false,
  })
  const [customCategories, setCustomCategories] = useState([])
  const [customCategoryInput, setCustomCategoryInput] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [multiScanOpen, setMultiScanOpen] = useState(false)
  const [showPremiumNote, setShowPremiumNote] = useState(false)
  const navigate = useNavigate()

  const toggleSection = (key) => setOpenSections(s => ({ ...s, [key]: !s[key] }))

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

  const handleNoteChange = (key, value) => {
    setNotes(prev => ({ ...prev, [key]: value }))
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

  const matchCategory = (aiCategory, available) => {
    if (!aiCategory) return ''
    const lower = aiCategory.toLowerCase()
    return available.find(c => c.toLowerCase() === lower)
      || available.find(c => lower.includes(c.toLowerCase()) || c.toLowerCase().includes(lower))
      || ''
  }

  const handlePhotoSelected = async (file) => {
    if (!file) return

    const reader = new FileReader()
    reader.onloadend = async () => {
      const base64 = reader.result
      setPhotoFile(file)
      setPhotoPreview(base64)

      if (!isPremium) return

      setAnalyzing(true)
      try {
        const mediaType = file.type || 'image/jpeg'
        const base64Data = base64.split(',')[1]

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'image',
                    source: { type: 'base64', media_type: mediaType, data: base64Data },
                  },
                  {
                    type: 'text',
                    text: `Identify the item in this photo and return ONLY a JSON object — no markdown, no code fences, no explanation.

The JSON must have exactly these fields:

- name: short descriptive item name (factual)
- category: best match from this list: ${PRESET_CATEGORIES.join(', ')}
- estimatedValue: numeric string in USD (digits only, no $ or commas), or empty string if unknown
- description: 1-2 sentences of factual description — make, model, material, approximate age, notable features
- origin: a single sentence opener the owner can finish, written in first person, ending with "..." — suggest where or how this type of item is typically acquired (e.g. "I came across this at...")
- history: 2-3 sentences written from a collector's perspective about this specific make/model/brand — what makes it historically significant, what collectors look for, what distinguishes this item from similar ones. Be factual and specific to what you can identify in the image.
- meaning: a single sentence opener the owner can finish, written in first person, ending with "..." — prompt them to reflect on personal significance (e.g. "This piece matters to me because...")
- legacy: a single sentence opener the owner can finish, written in first person, ending with "..." — prompt them to think about who should receive it (e.g. "When the time comes, I'd want this to go to...")`,
                  },
                ],
              },
            ],
          }),
        })

        const data = await response.json()
        const text = data.content?.[0]?.text?.trim() ?? ''
        const parsed = JSON.parse(text)

        setForm(prev => ({
          name: parsed.name || prev.name,
          category: matchCategory(parsed.category, allCategories) || prev.category,
          value: parsed.estimatedValue || prev.value,
          description: parsed.description || prev.description,
        }))
        setNotes({
          origin:  parsed.origin  || '',
          history: parsed.history || '',
          meaning: parsed.meaning || '',
          legacy:  parsed.legacy  || '',
        })
      } catch (err) {
        console.error('AI identification failed:', err)
      } finally {
        setAnalyzing(false)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const docRef = await addDoc(collection(db, 'assets'), {
      ...form,
      notes,
      details,
      ownership: { ...ownership, purchasePrice: numericOrEmpty(ownership.purchasePrice) },
      insurance: { ...insurance, coverageAmount: numericOrEmpty(insurance.coverageAmount) },
      uid: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    if (photoFile) {
      const storagePath = `users/${user.uid}/assets/${docRef.id}/photos/hero`
      const storageRef = ref(storage, storagePath)
      await uploadBytes(storageRef, photoFile)
      const imageUrl = await getDownloadURL(storageRef)
      await updateDoc(docRef, { imageUrl })
    }
    navigate('/registry')
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Add an Asset</h1>
      </div>

      <form onSubmit={handleSubmit}>
        {/* ── Item Details ── */}
        <div className="form-section">
          <div className="asset-form">

            {/* Photo upload */}
            <div className="photo-upload-zone full-width">
              {photoPreview ? (
                <div className="photo-preview-wrap">
                  <img className="photo-preview" src={photoPreview} alt="Asset preview" />
                  <div className="photo-preview-actions">
                    {analyzing ? (
                      <span className="photo-analyzing">Analyzing photo...</span>
                    ) : (
                      <span className="photo-analyzed">AI fields prefilled</span>
                    )}
                    <button
                      type="button"
                      className="btn-ghost btn-small"
                      onClick={() => {
                        setPhotoPreview(null)
                        setPhotoFile(null)
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <PhotoUploadButtons
                    onFileSelected={handlePhotoSelected}
                    label="Add Photo"
                    disabled={analyzing}
                  />
                  <button
                    type="button"
                    className={`scan-multi-btn ${isPremium ? '' : 'scan-multi-btn--locked'}`}
                    onClick={() => {
                      if (isPremium) {
                        setMultiScanOpen(true)
                      } else {
                        setShowPremiumNote(true)
                      }
                    }}
                    disabled={analyzing}
                  >
                    {!isPremium && <span className="scan-multi-lock">🔒</span>}
                    Scan Multiple Items
                  </button>
                  {showPremiumNote && !isPremium && (
                    <p className="scan-premium-note">Multi-scan is a Premium feature.</p>
                  )}
                </>
              )}
              {isPremium && !photoPreview && (
                <p className="photo-upload-hint">AI will identify the item and fill the story</p>
              )}
            </div>

            <input
              name="name"
              placeholder="Item name"
              value={form.name}
              onChange={handleChange}
              required
              className="full-width"
              disabled={analyzing}
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
              disabled={analyzing}
            />
            <input
              name="description"
              placeholder="Description"
              value={form.description}
              onChange={handleChange}
              className="full-width"
              disabled={analyzing}
            />
          </div>
        </div>

        {/* ── Details ── */}
        {(() => {
          const summary = summarize([details.condition, details.location])
          const open = openSections.details
          const activeCondition = details.condition || 'Unknown'
          return (
            <div className="detail-section">
              <button type="button" className="detail-section-toggle" onClick={() => toggleSection('details')}>
                <h2 className="section-label">Details</h2>
                <span className="detail-section-summary">
                  {summary || <span className="detail-section-empty">Add details</span>}
                </span>
                <span className="detail-section-chevron">{open ? '∧' : '∨'}</span>
              </button>
              {open && (
                <div className="detail-card detail-fields">
                  <div className="detail-field">
                    <div className="detail-field-label">Condition</div>
                    <div className="pill-row">
                      {CONDITION_OPTIONS.map(opt => (
                        <button
                          key={opt}
                          type="button"
                          className={`pill ${activeCondition === opt ? 'pill--active' : ''}`}
                          onClick={() => setDetails(d => ({ ...d, condition: opt === 'Unknown' ? '' : opt }))}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="detail-field">
                    <div className="detail-field-label">Location</div>
                    <input
                      type="text"
                      className="detail-field-input"
                      value={details.location}
                      onChange={e => setDetails(d => ({ ...d, location: e.target.value }))}
                      placeholder="e.g. Safe deposit box — First Bank"
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })()}

        {/* ── Ownership ── */}
        {(() => {
          const summary = summarize([
            ownership.acquisitionType,
            ownership.acquiredDate || null,
          ])
          const open = openSections.ownership
          const activeType = ownership.acquisitionType
          const currentPriceLabel = priceLabel(ownership.acquisitionType)
          return (
            <div className="detail-section">
              <button type="button" className="detail-section-toggle" onClick={() => toggleSection('ownership')}>
                <h2 className="section-label">Ownership</h2>
                <span className="detail-section-summary">
                  {summary || <span className="detail-section-empty">Add details</span>}
                </span>
                <span className="detail-section-chevron">{open ? '∧' : '∨'}</span>
              </button>
              {open && (
                <div className="detail-card detail-fields">
                  <div className="detail-field">
                    <div className="detail-field-label">Acquisition type</div>
                    <div className="pill-row">
                      {ACQUISITION_OPTIONS.map(opt => (
                        <button
                          key={opt}
                          type="button"
                          className={`pill ${activeType === opt ? 'pill--active' : ''}`}
                          onClick={() => setOwnership(o => ({ ...o, acquisitionType: opt }))}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="detail-field">
                    <div className="detail-field-label">Acquired from</div>
                    <input
                      type="text"
                      className="detail-field-input"
                      value={ownership.acquiredFrom}
                      onChange={e => setOwnership(o => ({ ...o, acquiredFrom: e.target.value }))}
                      placeholder="Person, dealer, or estate"
                    />
                  </div>
                  <div className="detail-field">
                    <div className="detail-field-label">Acquired date</div>
                    <input
                      type="date"
                      className="detail-field-input"
                      value={ownership.acquiredDate}
                      onChange={e => setOwnership(o => ({ ...o, acquiredDate: e.target.value }))}
                    />
                  </div>
                  <div className="detail-field">
                    <div className="detail-field-label">{currentPriceLabel}</div>
                    <input
                      type="number"
                      step="0.01"
                      className="detail-field-input"
                      value={ownership.purchasePrice}
                      onChange={e => setOwnership(o => ({ ...o, purchasePrice: e.target.value }))}
                      placeholder="0"
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })()}

        {/* ── Insurance & Appraisal ── */}
        {(() => {
          const summary = summarize([
            insurance.insurer,
            insurance.coverageAmount ? `$${insurance.coverageAmount} coverage` : null,
          ])
          const open = openSections.insurance
          return (
            <div className="detail-section">
              <button type="button" className="detail-section-toggle" onClick={() => toggleSection('insurance')}>
                <h2 className="section-label">Insurance & Appraisal</h2>
                <span className="detail-section-summary">
                  {summary || <span className="detail-section-empty">Add details</span>}
                </span>
                <span className="detail-section-chevron">{open ? '∧' : '∨'}</span>
              </button>
              {open && (
                <div className="detail-card detail-fields">
                  <div className="detail-field">
                    <div className="detail-field-label">Insurer</div>
                    <input
                      type="text"
                      className="detail-field-input"
                      value={insurance.insurer}
                      onChange={e => setInsurance(i => ({ ...i, insurer: e.target.value }))}
                      placeholder="Insurance company"
                    />
                  </div>
                  <div className="detail-field">
                    <div className="detail-field-label">Policy number</div>
                    <input
                      type="text"
                      className="detail-field-input"
                      value={insurance.policyNumber}
                      onChange={e => setInsurance(i => ({ ...i, policyNumber: e.target.value }))}
                      placeholder="Policy #"
                    />
                  </div>
                  <div className="detail-field">
                    <div className="detail-field-label">Coverage amount</div>
                    <input
                      type="number"
                      step="0.01"
                      className="detail-field-input"
                      value={insurance.coverageAmount}
                      onChange={e => setInsurance(i => ({ ...i, coverageAmount: e.target.value }))}
                      placeholder="0"
                    />
                  </div>
                  <div className="detail-field">
                    <div className="detail-field-label">Last appraised</div>
                    <input
                      type="date"
                      className="detail-field-input"
                      value={insurance.lastAppraised}
                      onChange={e => setInsurance(i => ({ ...i, lastAppraised: e.target.value }))}
                    />
                  </div>
                  <div className="detail-field">
                    <div className="detail-field-label">Appraised by</div>
                    <input
                      type="text"
                      className="detail-field-input"
                      value={insurance.appraisedBy}
                      onChange={e => setInsurance(i => ({ ...i, appraisedBy: e.target.value }))}
                      placeholder="Appraiser name"
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })()}

        {/* ── Provenance Story ── */}
        <div className="add-asset-notes-header">
          <h2 className="section-label">Provenance Story</h2>
          <p className="add-asset-notes-hint">
            {analyzing
              ? 'AI is drafting the story from your photo...'
              : 'Add the story behind this item. You can always edit later.'}
          </p>
        </div>

        <div className="provenance-notes">
          {NOTE_SECTIONS.map(({ key, label, placeholder }) => (
            <div key={key} className="note-section">
              <div className="note-section-header">
                <h3 className="note-section-label">{label}</h3>
              </div>
              <textarea
                className={`note-textarea${analyzing ? ' note-textarea--analyzing' : ''}`}
                placeholder={analyzing ? 'Writing...' : placeholder}
                value={notes[key]}
                onChange={e => handleNoteChange(key, e.target.value)}
                disabled={analyzing}
              />
            </div>
          ))}
        </div>

        <div className="add-asset-submit">
          <button type="submit" className="btn-primary" disabled={analyzing}>
            Add to Registry
          </button>
        </div>
      </form>

      {multiScanOpen && (
        <MultiScanFlow
          user={user}
          onClose={() => setMultiScanOpen(false)}
          onComplete={(result) => {
            setMultiScanOpen(false)
            navigate('/registry', { state: { scanResult: result } })
          }}
        />
      )}
    </div>
  )
}

export default AddAsset
