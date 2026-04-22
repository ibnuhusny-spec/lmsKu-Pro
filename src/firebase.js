import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth"; // MODUL BARU

const firebaseConfig = {
  apiKey: "AIzaSyAmEvT9DtYQSWG2THiMROGI5MJPxMHXJug",
  authDomain: "lmsku-pro.firebaseapp.com",
  projectId: "lmsku-pro",
  storageBucket: "lmsku-pro.firebasestorage.app",
  messagingSenderId: "1034895418174",
  appId: "1:1034895418174:web:8f3ee99c1c0ec1c326c26f"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// MENGAKTIFKAN LOGIN GMAIL
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();