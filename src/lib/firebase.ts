import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAZdGIvP33RxCRyYkGgN-16iUCKPWcyySw",
  authDomain: "xonvccna8.firebaseapp.com",
  databaseURL: "https://xonvccna8-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "xonvccna8",
  storageBucket: "xonvccna8.firebasestorage.app",
  messagingSenderId: "1020466597141",
  appId: "1:1020466597141:web:c8357c8fba55d88c8aed1c",
  measurementId: "G-NC51XYJWZK"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
