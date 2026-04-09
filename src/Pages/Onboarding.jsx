import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../firebase'
import { collection, addDoc, getDocs, query, where, doc, updateDoc } from 'firebase/firestore'

const FEATURE_CARDS = [
  {
    icon: '◈',
    title: 'Catalog Your Assets',
    description: 'Add photos, values, and details for everything that matters.',
  },
  {
    icon: '✦',
    title: 'Tell the Story',
    description: 'Document where things came from and what they mean to you.',
  },
  {
    icon: '◎',
    title: 'Share with Family',
    description: 'Invite beneficiaries to view your registry and express interest.',
  },
]

const STEPS = [
  {
    title: 'Take a photo',
    description: 'Upload a photo of any item and AI will identify it instantly.',
  },
  {
    title: 'Review and edit',
    description: 'Confirm the details and add your personal story.',
  },
  {
    title: 'Build your registry',
    description: 'Your complete estate catalog, always up to date.',
  },
]

function ProgressDots({ total, current }) {
  return (
    <div className="ob-dots">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`ob-dot ${i === current ? 'ob-dot--active' : ''}`} />
      ))}
    </div>
  )
}

function Onboarding({ user, onComplete }) {
  const [screen, setScreen] = useState(0)
  const navigate = useNavigate()

  const markComplete = async () => {
    const snap = await getDocs(query(
      collection(db, 'userSettings'),
      where('uid', '==', user.uid),
    ))
    if (snap.empty) {
      await addDoc(collection(db, 'userSettings'), { uid: user.uid, onboardingComplete: true })
    } else {
      await updateDoc(doc(db, 'userSettings', snap.docs[0].id), { onboardingComplete: true })
    }
    onComplete()
  }

  const finish = async (destination) => {
    await markComplete()
    navigate(destination, { replace: true })
  }

  const skip = () => setScreen(3)

  return (
    <div className="ob-root">
      {/* Skip button — screens 1-3 (indexes 1,2,3 but not 3 which is the last) */}
      {screen > 0 && screen < 3 && (
        <button className="ob-skip" onClick={skip}>Skip</button>
      )}

      {/* Animated screen area */}
      <div className="ob-body" key={screen}>
        {screen === 0 && (
          <div className="ob-screen ob-screen--welcome">
            <div className="ob-ornament" />
            <h1 className="ob-wordmark">Provenance</h1>
            <div className="ob-ornament" />
            <p className="ob-tagline">Your legacy, documented.</p>
            <p className="ob-subtext">
              Provenance helps you catalog what matters, tell its story, and pass it on with intention.
            </p>
            <button className="btn-primary ob-cta" onClick={() => setScreen(1)}>
              Get Started
            </button>
          </div>
        )}

        {screen === 1 && (
          <div className="ob-screen">
            <h2 className="ob-heading">Everything in one place</h2>
            <div className="ob-feature-cards">
              {FEATURE_CARDS.map((card) => (
                <div key={card.title} className="ob-feature-card">
                  <span className="ob-feature-icon">{card.icon}</span>
                  <div>
                    <div className="ob-feature-title">{card.title}</div>
                    <div className="ob-feature-desc">{card.description}</div>
                  </div>
                </div>
              ))}
            </div>
            <button className="btn-primary ob-cta" onClick={() => setScreen(2)}>Next</button>
          </div>
        )}

        {screen === 2 && (
          <div className="ob-screen">
            <h2 className="ob-heading">Getting started is easy</h2>
            <div className="ob-steps">
              {STEPS.map((step, i) => (
                <div key={step.title} className="ob-step">
                  <div className="ob-step-number">{i + 1}</div>
                  <div className="ob-step-body">
                    <div className="ob-step-title">{step.title}</div>
                    <div className="ob-step-desc">{step.description}</div>
                  </div>
                </div>
              ))}
            </div>
            <button className="btn-primary ob-cta" onClick={() => setScreen(3)}>Next</button>
          </div>
        )}

        {screen === 3 && (
          <div className="ob-screen ob-screen--ready">
            <div className="ob-ornament" />
            <h2 className="ob-heading ob-heading--centered">You're all set</h2>
            <p className="ob-subtext ob-subtext--centered">
              Start by adding your first asset. It takes less than 30 seconds.
            </p>
            <div className="ob-ready-actions">
              <button className="btn-primary ob-cta" onClick={() => finish('/add')}>
                Add Your First Asset
              </button>
              <button className="btn-ghost ob-cta-ghost" onClick={() => finish('/')}>
                Explore the App
              </button>
            </div>
          </div>
        )}
      </div>

      <ProgressDots total={4} current={screen} />
    </div>
  )
}

export default Onboarding
