import { auth } from '../firebase'
import { signOut } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'

const isPremium = false

function Profile({ user }) {
  const navigate = useNavigate()
  const handleSignOut = () => signOut(auth)

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Profile</h1>
      </div>

      <div className="profile-card">
        <div className="profile-avatar-wrap">
          {user.photoURL ? (
            <img className="profile-avatar" src={user.photoURL} alt={user.displayName} referrerPolicy="no-referrer" />
          ) : (
            <div className="profile-avatar-fallback">
              {user.displayName?.charAt(0) ?? '?'}
            </div>
          )}
        </div>
        <div className="profile-info">
          <div className="profile-name">{user.displayName}</div>
          <div className="profile-email">{user.email}</div>
        </div>
      </div>

      <div className="profile-section">
        <div className="profile-row">
          <span className="profile-row-label">Plan</span>
          <span className={`premium-badge ${isPremium ? 'premium-badge--active' : 'premium-badge--free'}`}>
            {isPremium ? 'Premium' : 'Free'}
          </span>
        </div>
        {!isPremium && (
          <p className="profile-upgrade-hint">Upgrade to unlock reports, archive, and more.</p>
        )}
      </div>

      <div className="profile-section">
        <button className="profile-menu-row" onClick={() => navigate('/archive')}>
          <div className="profile-menu-row-text">
            <span className="profile-menu-row-label">Archive</span>
            <span className="profile-menu-row-description">View and restore archived assets</span>
          </div>
          <span className="profile-menu-row-chevron">›</span>
        </button>
      </div>

      <div className="profile-section">
        <button className="btn-ghost profile-signout" onClick={handleSignOut}>
          Sign Out
        </button>
      </div>
    </div>
  )
}

export default Profile
