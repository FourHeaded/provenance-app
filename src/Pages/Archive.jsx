import { useState, useEffect } from 'react'
import { db } from '../firebase'
import { collection, getDocs, query, where, updateDoc, deleteDoc, doc } from 'firebase/firestore'

function Archive({ user }) {
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirmPermanent, setConfirmPermanent] = useState(null) // asset id

  useEffect(() => {
    const load = async () => {
      const q = query(collection(db, 'assets'), where('uid', '==', user.uid))
      const snapshot = await getDocs(q)
      const all = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      setAssets(all.filter(a => a.itemStatus === 'archived'))
      setLoading(false)
    }
    load()
  }, [])

  const handleReinstate = async (asset) => {
    await updateDoc(doc(db, 'assets', asset.id), { itemStatus: 'active' })
    setAssets(prev => prev.filter(a => a.id !== asset.id))
  }

  const handlePermanentDelete = async (id) => {
    await deleteDoc(doc(db, 'assets', id))
    setAssets(prev => prev.filter(a => a.id !== id))
    setConfirmPermanent(null)
  }

  if (loading) return <div className="page"><p className="placeholder-text">Loading...</p></div>

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Archive</h1>
        <p className="page-subtitle">Archived items are hidden from your registry.</p>
      </div>

      {assets.length === 0 ? (
        <p className="placeholder-text">No archived assets.</p>
      ) : (
        <div className="archive-list">
          {assets.map(asset => (
            <div key={asset.id} className="archive-card">
              <div className="archive-card-info">
                <div className="archive-asset-name">{asset.name}</div>
                <div className="archive-asset-meta">{asset.category}{asset.value ? ` · $${asset.value}` : ''}</div>
              </div>

              {confirmPermanent === asset.id ? (
                <div className="archive-confirm">
                  <span className="archive-confirm-text">Permanently delete?</span>
                  <button className="btn-ghost archive-btn" onClick={() => setConfirmPermanent(null)}>Cancel</button>
                  <button className="btn-danger archive-btn" onClick={() => handlePermanentDelete(asset.id)}>Delete</button>
                </div>
              ) : (
                <div className="archive-actions">
                  <button className="btn-ghost archive-btn" onClick={() => handleReinstate(asset)}>Reinstate</button>
                  <button className="archive-delete-btn" onClick={() => setConfirmPermanent(asset.id)}>Delete</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Archive
