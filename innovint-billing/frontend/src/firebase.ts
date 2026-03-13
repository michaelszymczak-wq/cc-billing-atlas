import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCWj7GVrfBeKi7LZ1PG-MPSIVvyeU7ExkU",
  authDomain: "cc-billing-11-11.firebaseapp.com",
  projectId: "cc-billing-atlas",
  storageBucket: "cc-billing-atlas.firebasestorage.app",
  messagingSenderId: "751625211556",
  appId: "1:751625211556:web:placeholder"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
