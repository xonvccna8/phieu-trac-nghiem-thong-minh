import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp } from 'firebase/app';
import { collection, doc, getDocs, getFirestore, query, setDoc, updateDoc, where } from 'firebase/firestore';

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

const API_KEY = firebaseConfig.apiKey;
const AUTH_SIGN_IN_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;
const AUTH_UPDATE_URL = `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${API_KEY}`;

// New simple credentials
function newPasswordForSbd(sbd) {
  return `123456`; // universal simple password for demo
}

// Old credentials from previous script
function oldEmailForSbd(sbd) {
  return `hs${sbd}@ptlttm.edu.vn`;
}
function oldPasswordForSbd(sbd) {
  return `Thi@${sbd}`;
}

async function authSignIn(email, password) {
  const res = await fetch(AUTH_SIGN_IN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  return res.json();
}

async function authUpdate(idToken, newEmail, newPassword) {
  const res = await fetch(AUTH_UPDATE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, password: newPassword, returnSecureToken: true }),
  });
  return res.json();
}

async function main() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const studentsSnap = await getDocs(collection(db, 'students'));
  const students = studentsSnap.docs.map((d) => d.data());
  // Keep only our generated 6-digit SBD students
  const target = students.filter((s) => /^[0-9]{6}$/.test(s.sbd));
  // Sort by SBD asc
  target.sort((a, b) => a.sbd.localeCompare(b.sbd));

  const lines = [
    'DANH SACH TAI KHOAN HOC SINH (SAU KHI DON GIAN HOA EMAIL & MAT KHAU)',
    `Ngay tao: ${new Date().toLocaleString('vi-VN')}`,
    '',
    'Dinh dang: SBD | Ho ten | Email moi | Mat khau moi',
    '---------------------------------------------------',
  ];

  for (const s of target) {
    const oldEmail = oldEmailForSbd(s.sbd);
    const oldPass = oldPasswordForSbd(s.sbd);
    const email = oldEmailForSbd(s.sbd); // keep email, just simplify password
    const password = newPasswordForSbd(s.sbd);

    // Sign in with old credentials to get idToken
    const signIn = await authSignIn(oldEmail, oldPass);
    if (!signIn.idToken) {
      // If cannot sign in with old creds, try with new (in case already updated)
      const signInNew = await authSignIn(email, password);
      if (!signInNew.idToken) {
        console.warn(`Bo qua: Khong dang nhap duoc ${s.fullName} (${s.sbd}) voi ca tai khoan cu & moi.`);
        continue;
      }
    } else {
      const upd = await authUpdate(signIn.idToken, email, password);
      if (!upd.idToken) {
        console.warn(`Canh bao: Khong doi duoc email/pass cho ${s.fullName} (${s.sbd}). Phan hoi: ${JSON.stringify(upd)}`);
      }
    }

    // Update Firestore users.email as well (no change now, but ensure consistency)
    const usersQuery = query(collection(db, 'users'), where('uid', '==', s.id));
    const usersSnap = await getDocs(usersQuery);
    if (!usersSnap.empty) {
      const refId = usersSnap.docs[0].id;
      await setDoc(
        doc(db, 'users', refId),
        { email },
        { merge: true }
      );
    } else {
      // In case we don't find by query, try set directly by uid
      await setDoc(doc(db, 'users', s.id), { email }, { merge: true });
    }

    lines.push(`${s.sbd} | ${s.fullName} | ${email} | ${password}`);
  }

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const outPath = path.resolve(__dirname, '../DANH_SACH_TAI_KHOAN_HS_DON_GIAN.txt');
  await fs.writeFile(outPath, lines.join('\n'), 'utf8');

  console.log(`Da cap nhat ${target.length} tai khoan.`);
  console.log(`File xuat: ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
