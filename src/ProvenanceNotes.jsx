import { useState, useEffect, useRef } from 'react'
import { db } from './firebase'
import { doc, updateDoc } from 'firebase/firestore'
import { getPrompts } from './provenancePrompts'
import './ProvenanceNotes.css'

const SECTIONS = [
  {
    key: 'origin',
    label: 'Origin',
    placeholder: 'Where did this come from?'
  },
  {
    key: 'history',
    label: 'History',
    placeholder: 'What has this been through?'
  },
  {
    key: 'meaning',
    label: 'Meaning',
    placeholder: 'Why does this matter?'
  },
  {
    key: 'legacy',
    label: 'Legacy',
    placeholder: 'Who should have this, and what should they know?'
  }
]

function NoteSection({ sectionKey, label, placeholder, value, category, assetId, onUpdate, isPremium }) {
  const [text, setText] = useState(value || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loadingAI, setLoadingAI] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const saveTimer = useRef(null)
  const prompts = getPrompts(category, sectionKey)

  useEffect(() => {
    setText(value || '')
  }, [value])

  const handleChange = (e) => {
    const newText = e.target.value
    setText(newText)
    setSaved(false)

    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      const ref = doc(db, 'assets', assetId)
      await updateDoc(ref, {
        [`notes.${sectionKey}`]: newText,
        updatedAt: new Date()
      })
      onUpdate(sectionKey, newText)
      setSaving(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }, 1500)
  }

  const handleChipClick = (prompt) => {
    const newText = text
      ? `${text.trimEnd()}\n\n${prompt} `
      : `${prompt} `
    setText(newText)
    setSaved(false)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      const ref = doc(db, 'assets', assetId)
      await updateDoc(ref, {
        [`notes.${sectionKey}`]: newText,
        updatedAt: new Date()
      })
      onUpdate(sectionKey, newText)
      setSaving(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }, 1500)
  }

  const handleAIAssist = async () => {
    if (!isPremium) {
      setShowUpgrade(true)
      return
    }

    setLoadingAI(true)

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [
            {
              role: 'user',
              content: `You are helping someone document the story of a cherished personal asset for their estate registry.

Asset details:
- Name: ${assetId}
- Category: ${category}
- Section: ${label}

Write a warm, personal, first-person opening paragraph (3-5 sentences) for the "${label}" section of this asset's provenance record.

Guidelines:
- Write as if you are the owner beginning to tell the story
- Be specific to the category and section
- Leave natural places for the owner to fill in personal details
- Tone should be reflective, warm, and dignified
- Do not use placeholders like [name] — write flowing prose that prompts memory
- Keep it under 100 words

Respond with only the paragraph text, nothing else.`
            }
          ]
        })
      })

      const data = await response.json()
      const aiText = data.content[0].text

      const newText = text
        ? `${text.trimEnd()}\n\n${aiText}`
        : aiText

      setText(newText)

      const ref = doc(db, 'assets', assetId)
      await updateDoc(ref, {
        [`notes.${sectionKey}`]: newText,
        updatedAt: new Date()
      })
      onUpdate(sectionKey, newText)

    } catch (err) {
      console.error('AI assist error:', err)
    }

    setLoadingAI(false)
  }

  return (
    <div className="note-section">
      <div className="note-section-header">
        <h3 className="note-section-label">{label}</h3>
        <div className="note-section-actions">
          {saving && <span className="save-status">Saving...</span>}
          {saved && <span className="save-status saved">Saved</span>}
          <button
            className="btn-ai-assist"
            onClick={handleAIAssist}
            disabled={loadingAI}
          >
            {loadingAI ? 'Writing...' : '✦ Help me write'}
          </button>
        </div>
      </div>

      <div className="prompt-chips">
        {prompts.map((prompt, i) => (
          <button
            key={i}
            className="prompt-chip"
            onClick={() => handleChipClick(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>

      <textarea
        className="note-textarea"
        value={text}
        onChange={handleChange}
        placeholder={placeholder}
      />

      {showUpgrade && (
        <div className="upgrade-prompt">
          <p>AI writing assist is a premium feature.</p>
          <div className="upgrade-prompt-actions">
            <button className="btn-ghost" onClick={() => setShowUpgrade(false)}>Maybe later</button>
            <button className="btn-primary btn-small">Upgrade to Premium</button>
          </div>
        </div>
      )}
    </div>
  )
}

function ProvenanceNotes({ asset, onUpdate, isPremium = false }) {
  const handleSectionUpdate = (sectionKey, value) => {
    onUpdate({
      ...asset,
      notes: {
        ...asset.notes,
        [sectionKey]: value
      }
    })
  }

  return (
    <div className="provenance-notes">
      {SECTIONS.map(section => (
        <NoteSection
          key={section.key}
          sectionKey={section.key}
          label={section.label}
          placeholder={section.placeholder}
          value={asset.notes?.[section.key] || ''}
          category={asset.category}
          assetId={asset.id}
          onUpdate={handleSectionUpdate}
          isPremium={isPremium}
        />
      ))}
    </div>
  )
}

export default ProvenanceNotes