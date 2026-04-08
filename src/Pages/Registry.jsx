import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../firebase'
import { collection, getDocs, query, where } from 'firebase/firestore'
import AssetDetail from '../AssetDetail'

function Registry({ user }) {
  const [assets, setAssets] = useState([])
  const [selectedAsset, setSelectedAsset] = useState(null)
  const [activeFilters, setActiveFilters] = useState([])
  const navigate = useNavigate()

  const loadAssets = async () => {
    const q = query(collection(db, 'assets'), where('uid', '==', user.uid))
    const snapshot = await getDocs(q)
    setAssets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
  }

  useEffect(() => {
    loadAssets()
  }, [])

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

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Registry</h1>
      </div>

      <div className="asset-list">
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
            {activeFilters.length > 0
              ? 'No assets match the selected filters.'
              : 'No assets yet. Tap + to add your first item.'}
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

export default Registry