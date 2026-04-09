// Full-screen multi-item AI photo scan flow.
// State machine: 'uploading' → 'scanning' → 'reviewing' → 'saving' → 'done'

import { useState } from 'react'
import { db } from '../firebase'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { PRESET_CATEGORIES } from '../categories'
import PhotoUploadButtons from './PhotoUploadButtons'

const PROVENANCE_KEYS = ['origin', 'history', 'meaning', 'legacy']
const PROVENANCE_LABELS = {
  origin:  'Origin',
  history: 'History',
  meaning: 'Meaning',
  legacy:  'Legacy',
}

function MultiScanFlow({ user, onClose, onComplete }) {
  const [stage, setStage]                 = useState('uploading')
  const [imageBase64, setImageBase64]     = useState(null)
  const [scannedItems, setScannedItems]   = useState([])
  const [currentIndex, setCurrentIndex]   = useState(0)
  const [scanError, setScanError]         = useState(null)
  const [provenanceOpen, setProvenanceOpen] = useState(false)

  // ── Upload → kick off the scan ───────────────────────────────
  const handleFileSelected = (file) => {
    setStage('scanning')
    setScanError(null)
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result
      setImageBase64(base64)
      runScan(base64.split(',')[1], file.type || 'image/jpeg')
    }
    reader.readAsDataURL(file)
  }

  const runScan = async (base64Data, mediaType) => {
    try {
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
          max_tokens: 4000,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: base64Data },
              },
              {
                type: 'text',
                text: `Identify all distinct valuable items visible in this photo. Return a JSON array of up to 8 items. Each item must have these exact fields:
- name: string (specific item name)
- category: string (one of: ${PRESET_CATEGORIES.join(', ')})
- estimatedValue: number (USD, realistic market estimate, no $ sign)
- description: string (2-3 sentences, factual and specific)
- origin: string (sentence starter ending in ... for user to complete, e.g. "This piece came from...")
- history: string (2-3 sentences about the item's make, model, or provenance from a collector's perspective)
- meaning: string (sentence starter ending in ...)
- legacy: string (sentence starter ending in ...)
Return ONLY a valid JSON array. No preamble, no explanation, no markdown.`,
              },
            ],
          }],
        }),
      })

      const data = await response.json()
      const text = data.content?.[0]?.text?.trim() ?? ''
      // Some models may wrap in ```json fences despite instructions; strip if present
      const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
      const items = JSON.parse(cleaned)
      if (!Array.isArray(items) || items.length === 0) {
        throw new Error('No items returned')
      }
      const capped = items.slice(0, 8).map(item => ({ ...item, confirmed: false }))
      setScannedItems(capped)
      setCurrentIndex(0)
      setProvenanceOpen(false)
      setStage('reviewing')
    } catch (e) {
      console.error('Multi-scan failed:', e)
      setScanError("Couldn't identify items. Try a clearer photo.")
    }
  }

  // ── Edit current item in place ────────────────────────────────
  const updateCurrentItem = (field, value) => {
    setScannedItems(prev => prev.map((item, i) =>
      i === currentIndex ? { ...item, [field]: value } : item
    ))
  }

  // ── Save & Continue / Skip handlers ───────────────────────────
  const handleAction = (confirmed) => {
    const updated = scannedItems.map((item, i) =>
      i === currentIndex ? { ...item, confirmed } : item
    )
    setScannedItems(updated)
    if (currentIndex === scannedItems.length - 1) {
      saveAllToFirestore(updated)
    } else {
      setCurrentIndex(currentIndex + 1)
      setProvenanceOpen(false)
    }
  }

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
      setProvenanceOpen(false)
    }
  }

  // ── Final batch write ─────────────────────────────────────────
  const saveAllToFirestore = async (items) => {
    setStage('saving')
    let confirmedCount = 0
    let pendingCount   = 0
    for (const item of items) {
      try {
        const docData = {
          uid: user.uid,
          name:        item.name || '',
          category:    item.category || '',
          value:       item.estimatedValue || '',
          description: item.description || '',
          notes: {
            origin:  item.origin  || '',
            history: item.history || '',
            meaning: item.meaning || '',
            legacy:  item.legacy  || '',
          },
          imageUrl:           '',
          additionalImages:   [],
          documents:          [],
          interestedParties:  [],
          details:            {},
          ownership:          {},
          insurance:          {},
          assignedBeneficiary: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
        if (!item.confirmed) {
          docData.itemStatus = 'pending'
        }
        await addDoc(collection(db, 'assets'), docData)
        if (item.confirmed) confirmedCount++
        else pendingCount++
      } catch (e) {
        console.error('Failed to save item:', e)
      }
    }
    onComplete({ confirmed: confirmedCount, pending: pendingCount })
  }

  // ── Close handler with confirmation in 'reviewing' ───────────
  const handleClose = () => {
    if (stage === 'saving') return
    if (stage === 'reviewing') {
      const ok = window.confirm('Cancel scan? Unconfirmed items will be saved as pending.')
      if (!ok) return
    }
    onClose()
  }

  const currentItem = scannedItems[currentIndex]
  const isLast = currentIndex === scannedItems.length - 1

  return (
    <div className="multiscan-overlay">
      {stage !== 'saving' && (
        <button className="multiscan-close-btn" onClick={handleClose} aria-label="Close">×</button>
      )}

      {/* ── Upload screen ── */}
      {stage === 'uploading' && (
        <div className="multiscan-stage multiscan-stage--upload">
          <h1 className="multiscan-title">Scan Multiple Items</h1>
          <p className="multiscan-subtitle">Photograph a group of items — AI will identify each one</p>
          <div className="multiscan-upload-buttons">
            <PhotoUploadButtons onFileSelected={handleFileSelected} label="Upload Photo" />
          </div>
          <p className="multiscan-hint">Up to 8 items per scan</p>
        </div>
      )}

      {/* ── Scanning screen ── */}
      {stage === 'scanning' && (
        <div className="multiscan-stage multiscan-stage--scan">
          {imageBase64 && (
            <div className="multiscan-scanning-pulse">
              <img className="multiscan-scanning-img" src={imageBase64} alt="" />
            </div>
          )}
          {scanError ? (
            <div className="multiscan-error">
              <p className="multiscan-error-text">{scanError}</p>
              <button
                className="btn-primary"
                onClick={() => {
                  setStage('uploading')
                  setScanError(null)
                  setImageBase64(null)
                }}
              >
                Try Again
              </button>
            </div>
          ) : (
            <p className="multiscan-status">Identifying items…</p>
          )}
        </div>
      )}

      {/* ── Reviewing screen ── */}
      {stage === 'reviewing' && currentItem && (
        <div className="multiscan-stage multiscan-stage--review">
          <div className="multiscan-progress">
            <button
              type="button"
              className="multiscan-back-btn"
              onClick={handleBack}
              disabled={currentIndex === 0}
              aria-label="Previous item"
            >
              ‹
            </button>
            <div className="multiscan-progress-text">
              Item {currentIndex + 1} of {scannedItems.length}
            </div>
            <div className="multiscan-progress-dots">
              {scannedItems.map((_, i) => (
                <div
                  key={i}
                  className={`multiscan-progress-dot ${
                    i === currentIndex ? 'multiscan-progress-dot--active' :
                    i < currentIndex  ? 'multiscan-progress-dot--done' : ''
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="multiscan-card">
            <div className="multiscan-card-num">{currentIndex + 1} / {scannedItems.length}</div>

            <div className="multiscan-card-fields">
              <input
                className="multiscan-name-input"
                value={currentItem.name || ''}
                onChange={e => updateCurrentItem('name', e.target.value)}
                placeholder="Item name"
              />

              <div className="pill-row multiscan-pill-row">
                {PRESET_CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    className={`pill ${currentItem.category === cat ? 'pill--active' : ''}`}
                    onClick={() => updateCurrentItem('category', cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="multiscan-value-wrap">
                <span className="multiscan-value-prefix">$</span>
                <input
                  type="number"
                  className="multiscan-value-input"
                  value={currentItem.estimatedValue ?? ''}
                  onChange={e => updateCurrentItem('estimatedValue', e.target.value)}
                  placeholder="0"
                />
              </div>

              <textarea
                className="multiscan-desc-input"
                rows={3}
                value={currentItem.description || ''}
                onChange={e => updateCurrentItem('description', e.target.value)}
                placeholder="Description"
              />

              <button
                type="button"
                className="multiscan-prov-toggle"
                onClick={() => setProvenanceOpen(o => !o)}
              >
                <span>{provenanceOpen ? '∧' : '∨'}</span> Provenance Story
              </button>
              {provenanceOpen && (
                <div className="multiscan-prov-fields">
                  {PROVENANCE_KEYS.map(key => (
                    <div key={key} className="multiscan-prov-field">
                      <div className="multiscan-prov-label">{PROVENANCE_LABELS[key]}</div>
                      <textarea
                        rows={2}
                        className="multiscan-prov-textarea"
                        value={currentItem[key] || ''}
                        onChange={e => updateCurrentItem(key, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="multiscan-card-actions">
              <button
                type="button"
                className="btn-ghost multiscan-skip-btn"
                onClick={() => handleAction(false)}
              >
                {isLast ? 'Skip & Finish' : 'Skip for now'}
              </button>
              <button
                type="button"
                className="btn-primary multiscan-save-btn"
                onClick={() => handleAction(true)}
              >
                {isLast ? 'Save & Finish' : 'Save & Continue'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Saving screen ── */}
      {stage === 'saving' && (
        <div className="multiscan-stage multiscan-stage--saving">
          <div className="multiscan-spinner" />
          <p className="multiscan-status">Saving your items…</p>
        </div>
      )}
    </div>
  )
}

export default MultiScanFlow
