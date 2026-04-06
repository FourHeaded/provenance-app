import { useState } from 'react'
import { auth, googleProvider } from './firebase'
import { signInWithPopup, signOut } from 'firebase/auth'
import './App.css'

function App() {
  const [user, setUser] = useState(null)

  const handleLogin = async () => {
    const result = await signInWithPopup(auth, googleProvider)
    setUser(result.user)
  }

  const handleLogout = async () => {
    await signOut(auth)
    setUser(null)
  }

  return (
    <div>
      <h1>Provenance</h1>
      <p>Track and pass down what matters.</p>

      {user ? (
        <div>
          <p>Welcome, {user.displayName}</p>
          <button onClick={handleLogout}>Sign Out</button>
        </div>
      ) : (
        <button onClick={handleLogin}>Sign in with Google</button>
      )}
    </div>
  )
}

export default App