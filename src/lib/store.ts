import { collection, doc, getDocs, getDoc, setDoc, deleteDoc, query, where, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { Exam, Assignment, Attempt, Student, Class, User } from '../types';

export const store = {
  getClasses: async (teacherId?: string): Promise<Class[]> => {
    try {
      let q = collection(db, 'classes') as any;
      if (teacherId) {
        q = query(q, where('teacherId', '==', teacherId));
      }
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data() as Class);
    } catch (error) {
      console.error("Error getting classes:", error);
      return [];
    }
  },
  saveClass: async (cls: Class) => {
    await setDoc(doc(db, 'classes', cls.id), cls);
  },
  deleteClass: async (id: string) => {
    await deleteDoc(doc(db, 'classes', id));
  },

  getExams: async (teacherId?: string): Promise<Exam[]> => {
    try {
      let q = collection(db, 'exams') as any;
      if (teacherId) {
        q = query(q, where('teacherId', '==', teacherId));
      }
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data() as Exam);
    } catch (error) {
      console.error("Error getting exams:", error);
      return [];
    }
  },
  saveExam: async (exam: Exam) => {
    await setDoc(doc(db, 'exams', exam.id), exam);
  },
  getExamById: async (id: string): Promise<Exam | undefined> => {
    try {
      const d = await getDoc(doc(db, 'exams', id));
      return d.exists() ? (d.data() as Exam) : undefined;
    } catch (error) {
      console.error("Error getting exam:", error);
      return undefined;
    }
  },

  getAssignments: async (teacherId?: string): Promise<Assignment[]> => {
    try {
      let q = collection(db, 'assignments') as any;
      if (teacherId) {
        q = query(q, where('teacherId', '==', teacherId));
      }
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data() as Assignment);
    } catch (error) {
      console.error("Error getting assignments:", error);
      return [];
    }
  },
  getAssignmentsByClass: async (classId: string): Promise<Assignment[]> => {
    try {
      const q = query(collection(db, 'assignments'), where('classId', '==', classId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data() as Assignment);
    } catch (error) {
      console.error("Error getting assignments by class:", error);
      return [];
    }
  },
  saveAssignment: async (assignment: Assignment) => {
    await setDoc(doc(db, 'assignments', assignment.id), assignment);
  },
  getAssignmentById: async (id: string): Promise<Assignment | undefined> => {
    try {
      const d = await getDoc(doc(db, 'assignments', id));
      return d.exists() ? (d.data() as Assignment) : undefined;
    } catch (error) {
      console.error("Error getting assignment:", error);
      return undefined;
    }
  },

  getAttempts: async (studentId?: string, assignmentId?: string): Promise<Attempt[]> => {
    try {
      let q = collection(db, 'attempts') as any;
      if (studentId) {
        q = query(q, where('studentId', '==', studentId));
      }
      if (assignmentId) {
        q = query(q, where('assignmentId', '==', assignmentId));
      }
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data() as Attempt);
    } catch (error) {
      console.error("Error getting attempts:", error);
      return [];
    }
  },
  saveAttempt: async (attempt: Attempt) => {
    await setDoc(doc(db, 'attempts', attempt.id), attempt);
  },
  getAttemptByAssignmentId: async (assignmentId: string): Promise<Attempt | undefined> => {
    try {
      const q = query(collection(db, 'attempts'), where('assignmentId', '==', assignmentId));
      const snapshot = await getDocs(q);
      return snapshot.empty ? undefined : (snapshot.docs[0].data() as Attempt);
    } catch (error) {
      console.error("Error getting attempt:", error);
      return undefined;
    }
  },

  getStudents: async (teacherId?: string): Promise<Student[]> => {
    try {
      let q = collection(db, 'students') as any;
      if (teacherId) {
        q = query(q, where('teacherId', '==', teacherId));
      }
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data() as Student);
    } catch (error) {
      console.error("Error getting students:", error);
      return [];
    }
  },
  saveStudent: async (student: Student) => {
    await setDoc(doc(db, 'students', student.id), student);
  },
  deleteStudent: async (id: string) => {
    await deleteDoc(doc(db, 'students', id));
  },

  getTeachers: async (): Promise<User[]> => {
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'TEACHER'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data() as User);
    } catch (error) {
      console.error("Error getting teachers:", error);
      return [];
    }
  },

  migrateOldDataForTeacher: async (teacherUid: string) => {
    const collectionsToMigrate = ['exams', 'classes', 'assignments', 'students'];
    for (const collName of collectionsToMigrate) {
      try {
        const snapshot = await getDocs(collection(db, collName));
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          if (!data.teacherId) {
            await setDoc(doc(db, collName, docSnap.id), { ...data, teacherId: teacherUid }, { merge: true });
          }
        }
      } catch (error) {
        console.error(`Error migrating ${collName}:`, error);
      }
    }
  },

  subscribeToClasses: (callback: (classes: Class[]) => void, teacherId?: string) => {
    let q = collection(db, 'classes') as any;
    if (teacherId) {
      q = query(q, where('teacherId', '==', teacherId));
    }
    return onSnapshot(q, (snapshot: any) => {
      callback(snapshot.docs.map((doc: any) => doc.data() as Class));
    }, (error: any) => console.error(error));
  },
  subscribeToExams: (callback: (exams: Exam[]) => void, teacherId?: string) => {
    let q = collection(db, 'exams') as any;
    if (teacherId) {
      q = query(q, where('teacherId', '==', teacherId));
    }
    return onSnapshot(q, (snapshot: any) => {
      callback(snapshot.docs.map((doc: any) => doc.data() as Exam));
    }, (error: any) => console.error(error));
  },
  subscribeToAssignments: (callback: (assignments: Assignment[]) => void, teacherId?: string) => {
    let q = collection(db, 'assignments') as any;
    if (teacherId) {
      q = query(q, where('teacherId', '==', teacherId));
    }
    return onSnapshot(q, (snapshot: any) => {
      callback(snapshot.docs.map((doc: any) => doc.data() as Assignment));
    }, (error: any) => console.error(error));
  },
  subscribeToStudentAssignments: (callback: (assignments: Assignment[]) => void, classId: string) => {
    const q = query(collection(db, 'assignments'), where('classId', '==', classId));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => doc.data() as Assignment));
    }, (error) => console.error(error));
  },
  subscribeToAttempts: (callback: (attempts: Attempt[]) => void, studentId?: string) => {
    let q = collection(db, 'attempts') as any;
    if (studentId) {
      q = query(q, where('studentId', '==', studentId));
    }
    return onSnapshot(q, (snapshot: any) => {
      callback(snapshot.docs.map((doc: any) => doc.data() as Attempt));
    }, (error: any) => console.error(error));
  },
  subscribeToClassAttempts: (callback: (attempts: Attempt[]) => void, classId: string) => {
    const q = query(collection(db, 'attempts'), where('classId', '==', classId));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => doc.data() as Attempt));
    }, (error) => console.error(error));
  },
  subscribeToTeacherAttempts: (callback: (attempts: Attempt[]) => void, teacherAssignmentIds: string[]) => {
    // If a teacher has no assignments, return empty array immediately
    if (teacherAssignmentIds.length === 0) {
      callback([]);
      // Return a dummy unsubscribe function
      return () => {};
    }
    
    // Firestore 'in' query has a limit of 10. For a real app, this should be handled robustly.
    // For this prototype, we'll chunk it or just fetch all and filter client side.
    // Given the constraints, let's just fetch all and filter.
    const q = collection(db, 'attempts');
    return onSnapshot(q, (snapshot: any) => {
      const allAttempts = snapshot.docs.map((doc: any) => doc.data() as Attempt);
      const filtered = allAttempts.filter(a => teacherAssignmentIds.includes(a.assignmentId));
      callback(filtered);
    }, (error: any) => console.error(error));
  },
  subscribeToStudents: (callback: (students: Student[]) => void, teacherId?: string) => {
    let q = collection(db, 'students') as any;
    if (teacherId) {
      q = query(q, where('teacherId', '==', teacherId));
    }
    return onSnapshot(q, (snapshot: any) => {
      callback(snapshot.docs.map((doc: any) => doc.data() as Student));
    }, (error: any) => console.error(error));
  }
};
