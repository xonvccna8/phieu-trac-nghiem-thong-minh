import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAZdGIvP33RxCRyYkGgN-16iUCKPWcyySw',
  authDomain: 'xonvccna8.firebaseapp.com',
  databaseURL: 'https://xonvccna8-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'xonvccna8',
  storageBucket: 'xonvccna8.firebasestorage.app',
  messagingSenderId: '1020466597141',
  appId: '1:1020466597141:web:c8357c8fba55d88c8aed1c',
  measurementId: 'G-NC51XYJWZK',
};

async function purgeCollection(db, collName) {
  const snap = await getDocs(collection(db, collName));
  let count = 0;
  for (const d of snap.docs) {
    await deleteDoc(doc(db, collName, d.id));
    count++;
  }
  return count;
}

async function main() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const attempts = await purgeCollection(db, 'attempts');
  const attemptDrafts = await purgeCollection(db, 'attemptDrafts');
  const assignments = await purgeCollection(db, 'assignments');
  console.log(`Purged: attempts=${attempts}, attemptDrafts=${attemptDrafts}, assignments=${assignments}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
