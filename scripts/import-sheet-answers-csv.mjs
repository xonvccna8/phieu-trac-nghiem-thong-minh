import fs from 'node:fs';
import path from 'node:path';
import { initializeApp } from 'firebase/app';
import { doc, getDoc, getFirestore, setDoc } from 'firebase/firestore';

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

function argValue(name) {
  const prefix = `--${name}=`;
  const found = process.argv.find((item) => item.startsWith(prefix));
  return found ? found.slice(prefix.length) : '';
}

function normalizePart1(v) {
  const x = String(v || '').trim().toUpperCase();
  return ['A', 'B', 'C', 'D'].includes(x) ? x : '';
}

function normalizePart2(v) {
  const x = String(v || '').trim().toUpperCase();
  if (['D', 'Đ', 'TRUE', 'T', '1'].includes(x)) return true;
  if (['S', 'FALSE', 'F', '0'].includes(x)) return false;
  return undefined;
}

function parseCsv(content) {
  const lines = content
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(',').map((c) => c.trim());
    const row = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? '';
    });
    return row;
  });
}

async function main() {
  const examId = argValue('examId');
  const csvFile = argValue('file');
  if (!examId || !csvFile) {
    console.error('Usage: node scripts/import-sheet-answers-csv.mjs --examId=<exam_id> --file=<csv_path>');
    process.exit(1);
  }

  const absolutePath = path.isAbsolute(csvFile) ? csvFile : path.resolve(process.cwd(), csvFile);
  if (!fs.existsSync(absolutePath)) {
    console.error(`CSV file not found: ${absolutePath}`);
    process.exit(1);
  }

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const csvRows = parseCsv(fs.readFileSync(absolutePath, 'utf8'));
  if (csvRows.length === 0) {
    console.error('CSV has no data rows.');
    process.exit(1);
  }

  let updatedCount = 0;
  for (const row of csvRows) {
    const code = String(row.code || row.ma_de || row.versionCode || '').trim();
    if (!code) continue;
    const versionId = `${examId}_${code}`;
    const ref = doc(db, 'exams', versionId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      console.warn(`Skip ${code}: version doc not found (${versionId}).`);
      continue;
    }
    const versionExam = snap.data();
    const part1 = { ...(versionExam.part1 || {}) };
    const part2 = { ...(versionExam.part2 || {}) };
    const part3 = { ...(versionExam.part3 || {}) };

    for (let i = 1; i <= 18; i += 1) {
      const answer = normalizePart1(row[`p1_${i}`] || row[`cau${i}`] || row[`part1_${i}`]);
      part1[i] = { ...(part1[i] || {}), answer };
    }

    for (let q = 1; q <= 4; q += 1) {
      const current = { ...(part2[q] || {}), answers: { ...((part2[q] || {}).answers || {}) } };
      for (const s of ['a', 'b', 'c', 'd']) {
        const parsed = normalizePart2(row[`p2_${q}${s}`] || row[`part2_${q}${s}`] || row[`${q}${s}`]);
        if (parsed !== undefined) current.answers[s] = parsed;
      }
      part2[q] = current;
    }

    for (let i = 1; i <= 6; i += 1) {
      const answer = String(row[`p3_${i}`] || row[`part3_${i}`] || '').trim();
      part3[i] = { ...(part3[i] || {}), answer };
    }

    await setDoc(ref, { ...versionExam, part1, part2, part3, updatedAt: Date.now() });
    updatedCount += 1;
  }

  console.log(`Import completed. Updated ${updatedCount} version(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

