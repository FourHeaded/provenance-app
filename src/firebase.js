import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: "AIzaSyCQErDvz3r_8bRKVCjBhM-IIcidD2Q612o",
  authDomain: "provenance-510ad.firebaseapp.com",
  projectId: "provenance-510ad",
  storageBucket: "provenance-510ad.firebasestorage.app",
  messagingSenderId: "874521900324",
  appId: "1:874521900324:web:846a629a8128cb890e6fb1"
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()
export const db = getFirestore(app)
export const storage = getStorage(app)