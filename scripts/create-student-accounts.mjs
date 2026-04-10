import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp } from 'firebase/app';
import { collection, doc, getDocs, getFirestore, query, setDoc, where } from 'firebase/firestore';

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
const AUTH_SIGN_UP_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`;
const AUTH_SIGN_IN_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;
const DEFAULT_PASSWORD_PREFIX = 'Thi@';

const group1Students = [
  ['000001', 'Huỳnh Thái An'],
  ['000002', 'Phạm Đình Bảo Anh'],
  ['000003', 'Tống Ngọc Hải Âu'],
  ['000004', 'Nguyễn Trọng Đạt'],
  ['000005', 'Nguyễn Quang Đạt'],
  ['000006', 'Nguyễn Anh Đức'],
  ['000007', 'Nguyễn Trung Dũng'],
  ['000008', 'Trần Minh Hoàng'],
  ['000009', 'Nguyễn Văn Huy'],
  ['000010', 'Nguyễn Dũng Kiên'],
  ['000011', 'Võ Tuấn Kiệt'],
  ['000012', 'Hoàng Khánh Ly'],
  ['000013', 'Trần Trà My'],
  ['000014', 'Nguyễn Văn Hoàng Sâm'],
  ['000015', 'Nguyễn Văn Sơn'],
  ['000016', 'Lưu Đình Tài'],
  ['000017', 'Nguyễn Hữu Tuấn'],
  ['000018', 'Phan Bá Tùng'],
  ['000019', 'Nguyễn Long Khánh'],
  ['000020', 'Nguyễn Bá Trường'],
];

const group2Students = [
  ['000021', 'Nguyễn Thị Quỳnh Chi'],
  ['000022', 'Nguyễn Trần Đăng'],
  ['000023', 'Trịnh Đức Duy'],
  ['000024', 'Thái Văn Duy'],
  ['000025', 'Lê Chu Tuấn Duy'],
  ['000026', 'Lê Huy Hoàng'],
  ['000027', 'Nguyễn Thị Thanh Huyền'],
  ['000028', 'Chương Tấn Sang'],
  ['000029', 'Nguyễn Thị Thảo Sương'],
  ['000030', 'Nguyễn Thị Hà Thủy'],
  ['000031', 'Nguyễn Thị Huyền Trang'],
  ['000032', 'Nguyễn Thị Cẩm Tú'],
  ['000033', 'Nguyễn Hoàng Tuấn'],
  ['000034', 'Hà Thảo Uyên'],
  ['000035', 'Lê Thị Bảo Hà'],
];

function toEmail(sbd) {
  return `hs${sbd}@ptlttm.edu.vn`;
}

function toPassword(sbd) {
  return `${DEFAULT_PASSWORD_PREFIX}${sbd}`;
}

async function authSignUp(email, password) {
  const res = await fetch(AUTH_SIGN_UP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      returnSecureToken: true,
    }),
  });
  return res.json();
}

async function authSignIn(email, password) {
  const res = await fetch(AUTH_SIGN_IN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      returnSecureToken: true,
    }),
  });
  return res.json();
}

async function getOrCreateClass(db, className, teacherId) {
  const classQuery = query(collection(db, 'classes'), where('name', '==', className));
  const classSnapshot = await getDocs(classQuery);
  if (!classSnapshot.empty) {
    const existing = classSnapshot.docs[0].data();
    return { id: existing.id, teacherId: existing.teacherId || teacherId };
  }

  const id = `${Date.now()}_${className.replace(/\s+/g, '_')}`;
  await setDoc(doc(db, 'classes', id), {
    id,
    name: className,
    teacherId,
    createdAt: Date.now(),
  });
  return { id, teacherId };
}

async function main() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const teacherSnapshot = await getDocs(query(collection(db, 'users'), where('role', '==', 'TEACHER')));
  if (teacherSnapshot.empty) {
    throw new Error('Không tìm thấy giáo viên trong collection users.');
  }

  const preferredTeacherDoc =
    teacherSnapshot.docs.find((d) => d.data().email === 'nvx@gmail.com') ?? teacherSnapshot.docs[0];
  const teacher = preferredTeacherDoc.data();
  const teacherId = teacher.uid;

  const group1Class = await getOrCreateClass(db, 'Nhóm 1', teacherId);
  const group2Class = await getOrCreateClass(db, 'Nhóm 2', teacherId);

  const allStudents = [
    ...group1Students.map(([sbd, fullName]) => ({ sbd, fullName, groupName: 'Nhóm 1', classId: group1Class.id })),
    ...group2Students.map(([sbd, fullName]) => ({ sbd, fullName, groupName: 'Nhóm 2', classId: group2Class.id })),
  ];

  const credentialLines = [
    'DANH SACH TAI KHOAN HOC SINH',
    `Ngay tao: ${new Date().toLocaleString('vi-VN')}`,
    '',
    'Dinh dang: Nhom | Ho ten | SBD | Email dang nhap | Mat khau',
    '--------------------------------------------------------------------------',
  ];

  for (const student of allStudents) {
    const email = toEmail(student.sbd);
    const password = toPassword(student.sbd);

    let uid = '';
    const signUpResult = await authSignUp(email, password);

    if (signUpResult.localId) {
      uid = signUpResult.localId;
    } else if (signUpResult.error?.message === 'EMAIL_EXISTS') {
      const signInResult = await authSignIn(email, password);
      if (!signInResult.localId) {
        throw new Error(`Email đã tồn tại nhưng không đăng nhập được: ${email}`);
      }
      uid = signInResult.localId;
    } else {
      throw new Error(`Tạo tài khoản thất bại (${email}): ${JSON.stringify(signUpResult)}`);
    }

    const now = Date.now();
    await setDoc(doc(db, 'users', uid), {
      uid,
      email,
      role: 'STUDENT',
      fullName: student.fullName,
      createdAt: now,
    });

    await setDoc(doc(db, 'students', uid), {
      id: uid,
      sbd: student.sbd,
      fullName: student.fullName,
      classId: student.classId,
      teacherId,
      createdAt: now,
    });

    credentialLines.push(
      `${student.groupName} | ${student.fullName} | ${student.sbd} | ${email} | ${password}`,
    );
  }

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const outputPath = path.resolve(__dirname, '../DANH_SACH_TAI_KHOAN_HOC_SINH_NHOM_1_2.txt');
  await fs.writeFile(outputPath, credentialLines.join('\n'), 'utf8');

  console.log(`Da tao/cap nhat ${allStudents.length} tai khoan hoc sinh.`);
  console.log(`File tai khoan: ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
