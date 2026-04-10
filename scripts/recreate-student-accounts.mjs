import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp } from 'firebase/app';
import { collection, deleteDoc, doc, getDocs, getFirestore, query, setDoc, where } from 'firebase/firestore';

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
const AUTH_DELETE_URL = `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${API_KEY}`;
const AUTH_SIGN_UP_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`;

function gmailForSbd(sbd) {
  return `hs${sbd}@gmail.com`;
}

async function authSignIn(email, password) {
  const res = await fetch(AUTH_SIGN_IN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  return res.json();
}

async function authDelete(idToken) {
  const res = await fetch(AUTH_DELETE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  return res.json();
}

async function authSignUp(email, password) {
  const res = await fetch(AUTH_SIGN_UP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  return res.json();
}

async function main() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const studentsSnap = await getDocs(collection(db, 'students'));
  const students = studentsSnap.docs.map((d) => d.data()).filter(s => /^[0-9]{6}$/.test(s.sbd));
  students.sort((a, b) => a.sbd.localeCompare(b.sbd));

  const lines = [
    'DANH SACH TAI KHOAN HOC SINH (GMAIL + MAT KHAU = SBD)',
    `Ngay tao: ${new Date().toLocaleString('vi-VN')}`,
    '',
    'Dinh dang: SBD | Ho ten | Email | Mat khau',
    '-------------------------------------------',
  ];

  for (const s of students) {
    const oldEmailsToTry = [
      `hs${s.sbd}@ptlttm.edu.vn`,
      `hs${s.sbd}@ptl.vn`,
      gmailForSbd(s.sbd),
    ];
    const passwordsToTry = [
      `123456`,
      `Thi@${s.sbd}`,
      s.sbd,
    ];

    let deleted = false;
    for (const email of oldEmailsToTry) {
      for (const pass of passwordsToTry) {
        const sign = await authSignIn(email, pass);
        if (sign.idToken) {
          const del = await authDelete(sign.idToken);
          if (!del.error) {
            deleted = true;
          }
          break;
        }
      }
      if (deleted) break;
    }

    const newEmail = gmailForSbd(s.sbd);
    const newPass = s.sbd; // exactly SBD
    const su = await authSignUp(newEmail, newPass);
    if (!su.localId) {
      throw new Error(`Khong tao duoc tai khoan moi cho ${s.fullName} (${s.sbd}): ${JSON.stringify(su)}`);
    }
    const newUid = su.localId;

    // Upsert users and students (delete old docs by previous id to avoid duplicates)
    try {
      await deleteDoc(doc(db, 'users', s.id));
    } catch {}
    try {
      await deleteDoc(doc(db, 'students', s.id));
    } catch {}

    await setDoc(doc(db, 'users', newUid), {
      uid: newUid,
      email: newEmail,
      role: 'STUDENT',
      fullName: s.fullName,
      createdAt: s.createdAt || Date.now(),
    });

    await setDoc(doc(db, 'students', newUid), {
      id: newUid,
      sbd: s.sbd,
      fullName: s.fullName,
      classId: s.classId,
      teacherId: s.teacherId,
      createdAt: s.createdAt || Date.now(),
    });

    lines.push(`${s.sbd} | ${s.fullName} | ${newEmail} | ${newPass}`);
  }

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const outPath = path.resolve(__dirname, '../DANH_SACH_TAI_KHOAN_HS_GMAIL_SBD.txt');
  await fs.writeFile(outPath, lines.join('\n'), 'utf8');

  console.log(`Da tao lai ${students.length} tai khoan voi gmail & mat khau = SBD.`);
  console.log(`File xuat: ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
