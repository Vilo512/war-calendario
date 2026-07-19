import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDVQRsvFqbldHEWGt-KZXUCsWu_uldiwq8",
  authDomain: "war-calendario.firebaseapp.com",
  projectId: "war-calendario",
  storageBucket: "war-calendario.firebasestorage.app",
  messagingSenderId: "216846008793",
  appId: "1:216846008793:web:ab017e9121fec4391e99c8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
export const db = getFirestore(app);
export const auth = getAuth(app);

export default app;
