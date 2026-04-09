import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../firebase'
import { collection, getDocs, query, where } from 'firebase/firestore'

// ── Constants ──────────────────────────────────────────────────────
const REQUIRED_DOC_CATEGORIES = ['will', 'poa-financial', 'poa-healthcare', 'living-will']

const DOC_CATEGORY_LABELS = {
  'will':           'Will & Testament',
  'poa-financial':  'Power of Attorney (Financial)',
  'poa-healthcare': 'Power of Attorney (Healthcare)',
  'living-will':    'Living Will / Advance Directive',
}

const DEFAULT_THUMB = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%231A1A1A'/%3E%3Crect x='60' y='60' width='80' height='60' rx='4' fill='none' stroke='%232F2F2F' stroke-width='2'/%3E%3Ccircle cx='85' cy='82' r='8' fill='none' stroke='%232F2F2F' stroke-width='2'/%3E%3Cpolyline points='60,120 85,95 105,112 125,88 140,120' fill='none' stroke='%232F2F2F' stroke-width='2'/%3E%3C/svg%3E"

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000

// ── Helpers ────────────────────────────────────────────────────────
function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function getCreatedTime(asset) {
  const c = asset?.createdAt
  if (!c) return 0
  if (typeof c.toDate === 'function') return c.toDate().getTime()
  if (typeof c.seconds === 'number') return c.seconds * 1000
  const t = new Date(c).getTime()
  return isNaN(t) ? 0 : t
}

function isReviewDue(lastReviewed) {
  if (!lastReviewed) return true
  const t = new Date(lastReviewed).getTime()
  if (isNaN(t)) return true
  return Date.now() - t > ONE_YEAR_MS
}

function formatShortDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDayDate() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function computeReadinessScore({ activeAssets, estateDocsByCategory, docsNeedingReview, activeBeneficiaries }) {
  // Assets pillar (33pts)
  let assetsScore = 0
  if (activeAssets.length >= 10)     assetsScore = 33
  else if (activeAssets.length >= 5) assetsScore = 24
  else if (activeAssets.length >= 1) assetsScore = 15

  // Documents pillar (34pts)
  const presentRequired = REQUIRED_DOC_CATEGORIES.filter(cat => (estateDocsByCategory[cat] || []).length > 0).length
  let docsScore = presentRequired * 8
  if (presentRequired > 0 && docsNeedingReview.length === 0) docsScore += 2

  // Beneficiaries pillar (33pts)
  let beneScore = 0
  if (activeBeneficiaries.length >= 2)      beneScore = 33
  else if (activeBeneficiaries.length === 1) beneScore = 20

  return assetsScore + docsScore + beneScore
}

function getNextSteps({ missingDocCategories, docsNeedingReview, activeBeneficiaries }) {
  const steps = []

  if (missingDocCategories.length > 0) {
    const missing = missingDocCategories[0]
    steps.push({
      title:    `Add your ${DOC_CATEGORY_LABELS[missing]}`,
      subtitle: 'A required estate document is missing',
      to:       '/documents',
    })
  }

  if (docsNeedingReview.length > 0) {
    const due = docsNeedingReview[0]
    const label = due.title || DOC_CATEGORY_LABELS[due.categoryId] || 'document'
    steps.push({
      title:    `Review your ${label}`,
      subtitle: 'Annual review recommended',
      to:       '/documents',
    })
  }

  if (activeBeneficiaries.length === 0) {
    steps.push({
      title:    'Invite a beneficiary',
      subtitle: 'Share your registry with family or your attorney',
      to:       '/profile',
    })
  }

  // Always include — covers the empty case too
  steps.push({
    title:    'Add more assets to your registry',
    subtitle: 'Document a few more items in your estate',
    to:       '/add',
  })

  return steps.slice(0, 3)
}

// ── Component ──────────────────────────────────────────────────────
function Home({ user }) {
  const navigate = useNavigate()
  const [loading, setLoading]             = useState(true)
  const [assets, setAssets]               = useState([])
  const [userSettings, setUserSettings]   = useState(null)
  const [invites, setInvites]             = useState([])
  const [estateDocs, setEstateDocs]       = useState([])

  useEffect(() => {
    const load = async () => {
      try {
        const [assetsSnap, settingsSnap, invitesSnap, estateDocsSnap] = await Promise.all([
          getDocs(query(collection(db, 'assets'),       where('uid', '==', user.uid))),
          getDocs(query(collection(db, 'userSettings'), where('uid', '==', user.uid))),
          getDocs(query(collection(db, 'invites'),      where('registryOwnerUid', '==', user.uid))),
          getDocs(query(collection(db, 'estateDocs'),   where('uid', '==', user.uid))),
        ])
        setAssets(assetsSnap.docs.map(d => ({ id: d.id, ...d.data() })))
        setUserSettings(settingsSnap.empty ? null : settingsSnap.docs[0].data())
        setInvites(invitesSnap.docs.map(d => ({ id: d.id, ...d.data() })))
        setEstateDocs(estateDocsSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch (e) {
        console.error('Home load failed:', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user.uid])

  if (loading) {
    return <div className="page"><p className="placeholder-text">Loading...</p></div>
  }

  // ── Derived values ──
  const activeAssets       = assets.filter(a => a.itemStatus !== 'archived')
  const recentAssets       = [...activeAssets].sort((a, b) => getCreatedTime(b) - getCreatedTime(a)).slice(0, 3)
  const activeBeneficiaries = invites.filter(i => i.status !== 'declined')

  const estateDocsByCategory = estateDocs.reduce((acc, d) => {
    const cat = d.categoryId
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(d)
    return acc
  }, {})

  const docsNeedingReview = estateDocs.filter(d => isReviewDue(d.lastReviewed))
  const missingDocCategories = REQUIRED_DOC_CATEGORIES.filter(
    cat => !(estateDocsByCategory[cat] || []).length
  )

  const score = computeReadinessScore({
    activeAssets,
    estateDocsByCategory,
    docsNeedingReview,
    activeBeneficiaries,
  })

  const readinessTitle =
    score > 75 ? 'Great foundation' :
    score < 25 ? "Let's get started" :
    'Your plan is taking shape'

  const areasNeedingAttention =
    (missingDocCategories.length > 0 ? 1 : 0) +
    (docsNeedingReview.length > 0   ? 1 : 0) +
    (activeBeneficiaries.length === 0 ? 1 : 0) +
    (activeAssets.length < 5        ? 1 : 0)

  const nextSteps = getNextSteps({
    missingDocCategories,
    docsNeedingReview,
    activeBeneficiaries,
  })

  const isPremium = userSettings?.isPremium === true

  // ── Header data ──
  const firstName = user.displayName?.split(' ')[0] || 'there'
  const greeting  = `${getGreeting()}, ${firstName}`
  const today     = formatDayDate()
  const initial   = (firstName[0] || '?').toUpperCase()

  return (
    <div className="page home-page">

      {/* ── Header ── */}
      <div className="home-header">
        <div className="home-header-text">
          <h1 className="home-greeting">{greeting}</h1>
          <p className="home-meta">Your estate plan · {today}</p>
        </div>
        <button className="home-avatar-btn" onClick={() => navigate('/profile')} aria-label="Profile">
          {user.photoURL ? (
            <img className="home-avatar" src={user.photoURL} alt={user.displayName} referrerPolicy="no-referrer" />
          ) : (
            <div className="home-avatar home-avatar--initials">{initial}</div>
          )}
        </button>
      </div>

      {/* ── Estate Readiness ── */}
      <h2 className="section-label">Estate Readiness</h2>
      <div className="home-readiness-card">
        <div className="home-readiness-top">
          <div className="home-readiness-titleblock">
            <div className="home-readiness-title">{readinessTitle}</div>
            <div className="home-readiness-subtitle">
              {areasNeedingAttention > 0
                ? `${areasNeedingAttention} ${areasNeedingAttention === 1 ? 'area needs' : 'areas need'} attention`
                : 'All clear'}
            </div>
          </div>
          <div className="home-readiness-scoreblock">
            <div className="home-readiness-score">{score}%</div>
            <div className="home-readiness-complete">COMPLETE</div>
          </div>
        </div>

        <div className="home-readiness-bar">
          <div className="home-readiness-bar-fill" style={{ width: `${score}%` }} />
        </div>

        <div className="home-pillar-grid">
          <button type="button" className="home-pillar-mini" onClick={() => navigate('/registry')}>
            <div className="home-pillar-mini-icon">▤</div>
            <div className="home-pillar-mini-label">Assets</div>
            <div className={`home-pillar-mini-status ${activeAssets.length > 0 ? 'home-pillar-mini-status--slate' : 'home-pillar-mini-status--faint'}`}>
              {activeAssets.length} {activeAssets.length === 1 ? 'item' : 'items'}
            </div>
          </button>
          <button type="button" className="home-pillar-mini" onClick={() => navigate('/documents')}>
            <div className="home-pillar-mini-icon">📄</div>
            <div className="home-pillar-mini-label">Documents</div>
            {docsNeedingReview.length > 0 ? (
              <div className="home-pillar-mini-status home-pillar-mini-status--gold">
                {docsNeedingReview.length} expiring
              </div>
            ) : (
              <div className="home-pillar-mini-status home-pillar-mini-status--slate">
                {estateDocs.length} on file
              </div>
            )}
          </button>
          <button type="button" className="home-pillar-mini" onClick={() => navigate('/profile')}>
            <div className="home-pillar-mini-icon">◯</div>
            <div className="home-pillar-mini-label">Beneficiaries</div>
            {activeBeneficiaries.length > 0 ? (
              <div className="home-pillar-mini-status home-pillar-mini-status--slate">
                {activeBeneficiaries.length} active
              </div>
            ) : (
              <div className="home-pillar-mini-status home-pillar-mini-status--faint">
                None added
              </div>
            )}
          </button>
        </div>
      </div>

      {/* ── Suggested Next Steps ── */}
      <h2 className="section-label">Suggested Next Steps</h2>
      <div className="home-next-step-list">
        {nextSteps.map((step, i) => (
          <button
            key={i}
            type="button"
            className="home-next-step"
            onClick={() => navigate(step.to)}
          >
            <div className="home-next-step-num">{i + 1}</div>
            <div className="home-next-step-text">
              <div className="home-next-step-title">{step.title}</div>
              <div className="home-next-step-subtitle">{step.subtitle}</div>
            </div>
            <span className="home-next-step-arrow">→</span>
          </button>
        ))}
      </div>

      {/* ── Your Estate ── */}
      <h2 className="section-label">Your Estate</h2>
      <div className="home-pillar-grid home-pillar-grid--large">
        <button className="home-pillar-card" onClick={() => navigate('/registry')}>
          <span className="home-pillar-card-icon home-pillar-card-icon--gold">▤</span>
          <span className="home-pillar-card-label">Registry</span>
          <span className="home-pillar-card-meta">{activeAssets.length} {activeAssets.length === 1 ? 'item' : 'items'}</span>
        </button>
        <button className="home-pillar-card" onClick={() => navigate('/documents')}>
          <span className="home-pillar-card-icon home-pillar-card-icon--slate">▦</span>
          <span className="home-pillar-card-label">Documents</span>
          <span className="home-pillar-card-meta">{estateDocs.length} on file</span>
        </button>
        <button className="home-pillar-card" onClick={() => navigate('/reports')}>
          <span className="home-pillar-card-icon home-pillar-card-icon--gold">↗</span>
          <span className="home-pillar-card-label">Reports</span>
          <span className="home-pillar-card-meta">Export PDF</span>
        </button>
      </div>

      {/* ── Beneficiaries ── */}
      <h2 className="section-label">Beneficiaries</h2>
      {activeBeneficiaries.length === 0 ? (
        <p className="home-quiet-nudge">
          No beneficiaries added yet.{' '}
          <button className="home-quiet-link" onClick={() => navigate('/profile')}>Invite someone →</button>
        </p>
      ) : (
        <div className="home-bene-strip">
          {activeBeneficiaries.map(inv => {
            const initials = (inv.invitedName || '?').trim().split(/\s+/).map(s => s[0]).join('').slice(0, 2).toUpperCase()
            const firstWord = (inv.invitedName || '').split(' ')[0]
            return (
              <button key={inv.id} className="home-bene-item" onClick={() => navigate('/profile')}>
                <div className="home-bene-circle">{initials || '?'}</div>
                <div className="home-bene-name">{firstWord}</div>
              </button>
            )
          })}
          <button className="home-bene-item" onClick={() => navigate('/profile')}>
            <div className="home-bene-circle home-bene-circle--add">+</div>
            <div className="home-bene-name">Invite</div>
          </button>
        </div>
      )}

      {/* ── Documents ── */}
      <h2 className="section-label">Documents</h2>
      <div className="home-doc-list">
        {REQUIRED_DOC_CATEGORIES.map(cat => {
          const docs = estateDocsByCategory[cat] || []
          const doc  = docs[0]
          const label = DOC_CATEGORY_LABELS[cat]
          if (!doc) {
            return (
              <div key={cat} className="home-doc-row">
                <span className="home-doc-icon">📄</span>
                <div className="home-doc-info">
                  <div className="home-doc-name">{label}</div>
                  <div className="home-doc-meta">Not on file</div>
                </div>
                <span className="home-doc-badge home-doc-badge--missing">Missing</span>
              </div>
            )
          }
          const overdue = isReviewDue(doc.lastReviewed)
          return (
            <div key={cat} className="home-doc-row">
              <span className="home-doc-icon">📄</span>
              <div className="home-doc-info">
                <div className="home-doc-name">{label}</div>
                <div className="home-doc-meta">Updated {formatShortDate(doc.lastReviewed)}</div>
              </div>
              <span className={`home-doc-badge ${overdue ? 'home-doc-badge--review' : 'home-doc-badge--current'}`}>
                {overdue ? 'Review due' : 'Current'}
              </span>
            </div>
          )
        })}
      </div>
      <button className="home-see-all" onClick={() => navigate('/documents')}>
        View all documents →
      </button>

      {/* ── Recently Added Assets ── */}
      <h2 className="section-label">Recently Added Assets</h2>
      {recentAssets.length === 0 ? (
        <p className="home-quiet-nudge">
          No assets cataloged yet.{' '}
          <button className="home-quiet-link" onClick={() => navigate('/add')}>Add your first →</button>
        </p>
      ) : (
        <>
          <div className="home-asset-list">
            {recentAssets.map(asset => {
              const thumb = asset.imageUrl || asset.imageBase64 || DEFAULT_THUMB
              return (
                <button
                  key={asset.id}
                  className="home-asset-row"
                  onClick={() => navigate(`/asset/${asset.id}`, { state: { asset } })}
                >
                  <img src={thumb} alt="" className="home-asset-thumb" />
                  <div className="home-asset-info">
                    <div className="home-asset-name">{asset.name}</div>
                    <div className="home-asset-cat">{asset.category}</div>
                  </div>
                  <div className="home-asset-value">${asset.value || '0'}</div>
                </button>
              )
            })}
          </div>
          <button className="home-see-all" onClick={() => navigate('/registry')}>
            View full registry →
          </button>
        </>
      )}

      {/* ── Premium nudge ── */}
      {!isPremium && (
        <button
          type="button"
          className="home-premium-nudge"
          onClick={() => navigate('/profile')}
        >
          <span className="home-premium-icon">✦</span>
          <div className="home-premium-text">
            <div className="home-premium-title">AI Writing Assist</div>
            <div className="home-premium-subtitle">Let AI help document the story behind each item.</div>
          </div>
          <span className="home-premium-pill">Premium</span>
        </button>
      )}
    </div>
  )
}

export default Home
