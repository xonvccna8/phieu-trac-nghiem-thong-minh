import { initializeApp } from 'firebase/app';
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  query,
  setDoc,
  where,
} from 'firebase/firestore';

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

function makeBaseExam(examId, teacherId, now) {
  const part1 = {};
  const part2 = {};
  const part3 = {};

  for (let i = 1; i <= 18; i += 1) {
    part1[i] = {
      question: '',
      choices: { A: '', B: '', C: '', D: '' },
      answer: '',
      explanation: '',
    };
  }
  for (let i = 1; i <= 4; i += 1) {
    part2[i] = {
      question: '',
      statements: { a: '', b: '', c: '', d: '' },
      answers: { a: false, b: false, c: false, d: false },
      explanations: {
        a: { explanation: '' },
        b: { explanation: '' },
        c: { explanation: '' },
        d: { explanation: '' },
      },
    };
  }
  for (let i = 1; i <= 6; i += 1) {
    part3[i] = {
      question: '',
      answer: '',
      explanation: '',
    };
  }

  return {
    id: examId,
    title: 'ĐỀ THI THỬ TỐT NGHIỆP NĂM 2026 - LẦN 101',
    teacherId,
    templateType: 'LEGACY_PHIU_TRA_LOI',
    status: 'PUBLISHED',
    part1,
    part2,
    part3,
    mixingSettings: {
      enabled: true,
      versionCount: 20,
      codeStyle: 'NUMERIC',
      shuffleQuestions: false,
      shuffleChoices: false,
      keepPartOrder: true,
      shuffleWithinPartOnly: true,
      keepPart3Fixed: true,
    },
    createdAt: now,
    updatedAt: now,
  };
}

function makeMappings() {
  const mappings = [];
  for (let i = 1; i <= 18; i += 1) {
    mappings.push({
      part: 1,
      originalQuestionNumber: i,
      versionQuestionNumber: i,
      originalCorrectAnswer: '',
      shuffledCorrectAnswer: '',
      choiceMappings: [
        { originalChoice: 'A', shuffledChoice: 'A', isCorrect: false },
        { originalChoice: 'B', shuffledChoice: 'B', isCorrect: false },
        { originalChoice: 'C', shuffledChoice: 'C', isCorrect: false },
        { originalChoice: 'D', shuffledChoice: 'D', isCorrect: false },
      ],
    });
  }
  for (let i = 1; i <= 4; i += 1) {
    mappings.push({
      part: 2,
      originalQuestionNumber: i,
      versionQuestionNumber: i,
      choiceMappings: [
        { originalChoice: 'a', shuffledChoice: 'a', isCorrect: false },
        { originalChoice: 'b', shuffledChoice: 'b', isCorrect: false },
        { originalChoice: 'c', shuffledChoice: 'c', isCorrect: false },
        { originalChoice: 'd', shuffledChoice: 'd', isCorrect: false },
      ],
    });
  }
  for (let i = 1; i <= 6; i += 1) {
    mappings.push({
      part: 3,
      originalQuestionNumber: i,
      versionQuestionNumber: i,
    });
  }
  return mappings;
}

async function resolveTeacherId(db, explicitTeacherId) {
  if (explicitTeacherId) return explicitTeacherId;

  const teacherUsers = await getDocs(query(collection(db, 'users'), where('role', '==', 'TEACHER')));
  if (!teacherUsers.empty) {
    const teacher = teacherUsers.docs[0].data();
    if (teacher?.uid) return teacher.uid;
  }

  const exams = await getDocs(collection(db, 'exams'));
  for (const exam of exams.docs) {
    const data = exam.data();
    if (data?.teacherId && !data?.isExamVersion) return data.teacherId;
  }

  throw new Error('Không tìm thấy teacherId. Hãy chạy với --teacherId=YOUR_UID');
}

async function main() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const now = Date.now();
  const teacherId = await resolveTeacherId(db, argValue('teacherId'));
  const examId = `sheet_lan101_${now}`;
  const baseExam = makeBaseExam(examId, teacherId, now);
  const mappings = makeMappings();

  await setDoc(doc(db, 'exams', examId), baseExam);

  for (let i = 0; i < 20; i += 1) {
    const code = String(1101 + i);
    const versionId = `${examId}_${code}`;
    const versionExam = {
      ...baseExam,
      id: `${examId}__${code}`,
      title: `${baseExam.title} - Mã đề ${code}`,
      parentExamId: examId,
      isExamVersion: true,
      versionCode: code,
      versionMappings: mappings,
      versionConfig: baseExam.mixingSettings,
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(doc(db, 'exams', versionId), versionExam);
  }

  console.log('Created sheet exam successfully.');
  console.log(`examId=${examId}`);
  console.log(`title=${baseExam.title}`);
  console.log('versionCodes=1101..1120');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

