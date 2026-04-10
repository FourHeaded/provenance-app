import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { db } from '../firebase'
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore'

const SORT_OPTIONS = [
  { key: 'newest',     label: 'Newest' },
  { key: 'oldest',     label: 'Oldest' },
  { key: 'name-asc',   label: 'Name A–Z' },
  { key: 'name-desc',  label: 'Name Z–A' },
  { key: 'value-desc', label: 'Value High–Low' },
  { key: 'value-asc',  label: 'Value Low–High' },
]

const ListIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <line x1="3" y1="4" x2="13" y2="4" />
    <line x1="3" y1="8" x2="13" y2="8" />
    <line x1="3" y1="12" x2="13" y2="12" />
  </svg>
)

const GridIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="3" width="4" height="4" rx="0.5" />
    <rect x="9" y="3" width="4" height="4" rx="0.5" />
    <rect x="3" y="9" width="4" height="4" rx="0.5" />
    <rect x="9" y="9" width="4" height="4" rx="0.5" />
  </svg>
)

const PlaceholderIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="9" cy="11" r="1.5" />
    <path d="M3 17l5-5 5 5 3-3 5 5" />
  </svg>
)

function Registry({ user }) {
  const [assets, setAssets] = useState([])
  const [activeFilters, setActiveFilters] = useState([])
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState(() => {
    if (typeof window === 'undefined') return 'newest'
    return localStorage.getItem('prov-registry-sort') || 'newest'
  })
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window === 'undefined') return 'list'
    return localStorage.getItem('prov-registry-view') || 'list'
  })
  const [scanBanner, setScanBanner] = useState(null)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    localStorage.setItem('prov-registry-sort', sortBy)
  }, [sortBy])

  useEffect(() => {
    localStorage.setItem('prov-registry-view', viewMode)
  }, [viewMode])

  const loadAssets = async () => {
    const q = query(collection(db, 'assets'), where('uid', '==', user.uid))
    const snapshot = await getDocs(q)
    setAssets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(a => a.itemStatus !== 'archived'))
  }

  useEffect(() => {
    loadAssets()
  }, [])

  // Pick up the scan-result banner from navigation state, then clear
  // it so a refresh doesn't re-show the banner.
  useEffect(() => {
    const result = location.state?.scanResult
    if (result) {
      setScanBanner(result)
      navigate(location.pathname, { replace: true, state: {} })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const dismissAllPending = async () => {
    const pending = assets.filter(a => a.itemStatus === 'pending')
    await Promise.all(pending.map(p =>
      updateDoc(doc(db, 'assets', p.id), { itemStatus: null })
    ))
    setAssets(prev => prev.map(a =>
      a.itemStatus === 'pending' ? { ...a, itemStatus: null } : a
    ))
  }

  const toggleFilter = (category) => {
    setActiveFilters(prev =>
      prev.includes(category)
        ? prev.filter(f => f !== category)
        : [...prev, category]
    )
  }

  const pendingAssets = assets.filter(a => a.itemStatus === 'pending')
  const activeAssets  = assets.filter(a => a.itemStatus !== 'pending')

  const usedCategories = [...new Set(activeAssets.map(a => a.category).filter(Boolean))]

  const searchTerm = search.trim().toLowerCase()

  const filteredAssets = activeAssets.filter(a => {
    const matchesFilter = activeFilters.length === 0 || activeFilters.includes(a.category)
    const matchesSearch = !searchTerm
      || a.name?.toLowerCase().includes(searchTerm)
      || a.category?.toLowerCase().includes(searchTerm)
      || a.description?.toLowerCase().includes(searchTerm)
    return matchesFilter && matchesSearch
  })

  // Normalize createdAt (Firestore Timestamp | number | string | missing) to millis.
  // Returns null when missing so we can sort missing entries to the end.
  const getCreatedMs = (a) => {
    const c = a.createdAt
    if (c == null) return null
    if (typeof c.toMillis === 'function') return c.toMillis()
    if (typeof c === 'number') return c
    if (typeof c === 'object' && typeof c.seconds === 'number') return c.seconds * 1000
    const t = new Date(c).getTime()
    return Number.isNaN(t) ? null : t
  }

  const getValueNum = (a) => {
    const v = a.value
    if (v == null || v === '') return 0
    const n = typeof v === 'number' ? v : parseFloat(v)
    return Number.isNaN(n) ? 0 : n
  }

  const getNameStr = (a) => (a.name || '').toLowerCase()

  const compareDate = (asc) => (a, b) => {
    const ta = getCreatedMs(a)
    const tb = getCreatedMs(b)
    if (ta == null && tb == null) return 0
    if (ta == null) return 1   // missing → end
    if (tb == null) return -1
    return asc ? ta - tb : tb - ta
  }

  const sortComparator = (a, b) => {
    switch (sortBy) {
      case 'oldest':     return compareDate(true)(a, b)
      case 'name-asc':   return getNameStr(a).localeCompare(getNameStr(b))
      case 'name-desc':  return getNameStr(b).localeCompare(getNameStr(a))
      case 'value-desc': return getValueNum(b) - getValueNum(a)
      case 'value-asc':  return getValueNum(a) - getValueNum(b)
      case 'newest':
      default:           return compareDate(false)(a, b)
    }
  }

  const sortedAssets = [...filteredAssets].sort(sortComparator)

  // Group sorted assets by category for gallery view. Categories are
  // sorted alphabetically; within each, items keep the active sort order.
  // Empty groups (e.g. categories that didn't survive search) are skipped
  // implicitly because we only iterate sortedAssets.
  const galleryGroups = (() => {
    const groups = new Map()
    sortedAssets.forEach(a => {
      const cat = a.category || 'Uncategorized'
      if (!groups.has(cat)) groups.set(cat, [])
      groups.get(cat).push(a)
    })
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
  })()

  const totalValue = sortedAssets.reduce((sum, a) => sum + getValueNum(a), 0)
  const formatCurrency = (n) => '$' + Math.round(n).toLocaleString('en-US')

  const renderThumb = (asset, kind) => {
    const src = asset.imageUrl || asset.imageBase64
    const baseClass = kind === 'list' ? 'asset-list-thumb' : 'gallery-card-photo'
    if (src) {
      return <img className={baseClass} src={src} alt="" />
    }
    return (
      <div className={`${baseClass} asset-list-placeholder`}>
        <PlaceholderIcon />
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header registry-header">
        <h1 className="page-title">Registry</h1>
        <div className="registry-view-toggle" role="group" aria-label="View mode">
          <button
            type="button"
            className={`registry-toggle-btn ${viewMode === 'list' ? 'registry-toggle-btn--active' : ''}`}
            aria-label="List view"
            aria-pressed={viewMode === 'list'}
            onClick={() => setViewMode('list')}
          >
            <ListIcon />
          </button>
          <button
            type="button"
            className={`registry-toggle-btn ${viewMode === 'gallery' ? 'registry-toggle-btn--active' : ''}`}
            aria-label="Gallery view"
            aria-pressed={viewMode === 'gallery'}
            onClick={() => setViewMode('gallery')}
          >
            <GridIcon />
          </button>
        </div>
      </div>

      {scanBanner && (
        <div className="scan-banner">
          <span className="scan-banner-icon">✓</span>
          <span className="scan-banner-text">
            {scanBanner.confirmed} item{scanBanner.confirmed === 1 ? '' : 's'} added to your registry.
            {scanBanner.pending > 0 && (
              <> {scanBanner.pending} pending item{scanBanner.pending === 1 ? '' : 's'} need photos and details.</>
            )}
          </span>
          <button className="scan-banner-close" onClick={() => setScanBanner(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      {pendingAssets.length > 0 && (
        <div className="pending-section">
          <h2 className="section-label pending-section-label">Finish These Items</h2>
          <p className="pending-section-subtitle">
            These items were scanned but still need photos and details
          </p>
          <div className="pending-list">
            {pendingAssets.map(asset => (
              <button
                key={asset.id}
                type="button"
                className="pending-row"
                onClick={() => navigate(`/asset/${asset.id}`, { state: { asset } })}
              >
                <div className="pending-row-info">
                  <div className="pending-row-name">{asset.name || 'Untitled item'}</div>
                  <div className="pending-row-cat">{asset.category || 'Uncategorized'}</div>
                </div>
                <span className="pending-row-action">Tap to complete →</span>
              </button>
            ))}
          </div>
          <button type="button" className="pending-dismiss-all" onClick={dismissAllPending}>
            Dismiss all
          </button>
        </div>
      )}

      <div className="registry-search-wrap">
        <input
          className="registry-search"
          type="search"
          placeholder="Search by name, category, or description…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <p className="registry-export-nudge">
        Want a printable record of your assets?{' '}
        <button
          type="button"
          className="registry-export-link"
          onClick={() => navigate('/reports')}
        >
          Generate Registry Export →
        </button>
      </p>

      <div className="sort-bar">
        {SORT_OPTIONS.map(opt => (
          <button
            key={opt.key}
            type="button"
            className={`filter-chip ${sortBy === opt.key ? 'active' : ''}`}
            onClick={() => setSortBy(opt.key)}
          >
            {opt.label}
          </button>
        ))}
      </div>

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

      <div className="registry-results-meta">
        {viewMode === 'gallery'
          ? `${sortedAssets.length} item${sortedAssets.length === 1 ? '' : 's'} · ${galleryGroups.length} categor${galleryGroups.length === 1 ? 'y' : 'ies'}`
          : `${sortedAssets.length} item${sortedAssets.length === 1 ? '' : 's'}`}
      </div>

      {sortedAssets.length === 0 ? (
        <p className="empty-state">
          {searchTerm || activeFilters.length > 0
            ? 'No assets match your search.'
            : 'No assets yet. Tap + to add your first item.'}
        </p>
      ) : viewMode === 'list' ? (
        <div className="asset-list-rows">
          {sortedAssets.map(asset => (
            <div
              key={asset.id}
              className="asset-list-row"
              onClick={() => navigate(`/asset/${asset.id}`, { state: { asset } })}
            >
              {renderThumb(asset, 'list')}
              <div className="asset-list-info">
                <div className="asset-list-name">{asset.name || 'Untitled item'}</div>
                {asset.category && <div className="asset-list-cat">{asset.category}</div>}
                {asset.description && <div className="asset-list-desc">{asset.description}</div>}
              </div>
              <div className="asset-list-right">
                <div className="asset-list-right-meta">
                  <span className="asset-list-value">{formatCurrency(getValueNum(asset))}</span>
                  {asset.details?.condition && (
                    <span className="asset-list-cond">{asset.details.condition}</span>
                  )}
                </div>
                <span className="asset-list-chev">›</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="gallery-groups">
          {galleryGroups.map(([cat, items]) => (
            <div key={cat} className="gallery-group">
              <div className="gallery-cat-header">
                <span className="gallery-cat-name">{cat}</span>
                <span className="gallery-cat-count">
                  {items.length} item{items.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="gallery-grid">
                {items.map(asset => (
                  <div
                    key={asset.id}
                    className="gallery-card"
                    onClick={() => navigate(`/asset/${asset.id}`, { state: { asset } })}
                  >
                    {renderThumb(asset, 'gallery')}
                    <div className="gallery-card-info">
                      <div className="gallery-card-name">{asset.name || 'Untitled item'}</div>
                      <div className="gallery-card-value">{formatCurrency(getValueNum(asset))}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="registry-total-bar">
        <span className="registry-total-label">Total estimated value</span>
        <span className="registry-total-value">{formatCurrency(totalValue)}</span>
      </div>
    </div>
  )
}

export default Registry
