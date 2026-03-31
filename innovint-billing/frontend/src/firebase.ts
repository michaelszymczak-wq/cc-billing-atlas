import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBY1MbajKL8Cx21FGyThdtYTfqg7itLN5I",
  authDomain: "cc-billing-atlas.firebaseapp.com",
  projectId: "cc-billing-atlas",
  storageBucket: "cc-billing-atlas.firebasestorage.app",
  messagingSenderId: "718388915148",
  appId: "1:718388915148:web:2b225425a084d6f84e4b69"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
