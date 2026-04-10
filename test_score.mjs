import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, getDoc } from "firebase/firestore";

const firebaseConfig = {
  projectId: "xonvccna8",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const attempts = await getDocs(collection(db, "attempts"));
  const aDocs = attempts.docs.map(i => i.data());
  console.log("Total attempts:", aDocs.length);
  const attempt0 = aDocs[aDocs.length - 1]; // Let's check the latest one
  console.log("Latest attempt answersPart1:", attempt0.answersPart1);
  console.log("Latest attempt score:", attempt0.score);
  
  if (attempt0.assignmentId) {
     const assignment = (await getDoc(doc(db, "assignments", attempt0.assignmentId))).data();
     console.log("Assignment title:", assignment?.titleSnapshot);
     
     if (assignment?.examId) {
        const exam = (await getDoc(doc(db, "exams", assignment.examId))).data();
         console.log("Exam part1[1]:", exam?.part1['1']);
     }
  }
}
run();
