import { collection, doc, getDocs, getDoc, setDoc, deleteDoc, query, where, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { Exam, Assignment, Attempt, AttemptDraft, Student, Class, User, ExamVersion } from '../types';

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
      return snapshot.docs
        .map(doc => doc.data() as Exam)
        .filter(exam => !exam.isDeleted && !exam.isExamVersion);
    } catch (error) {
      console.error("Error getting exams:", error);
      return [];
    }
  },
  saveExam: async (exam: Exam) => {
    await setDoc(doc(db, 'exams', exam.id), exam);
  },
  softDeleteExam: async (id: string) => {
    // Mark exam as deleted (soft delete)
    await setDoc(doc(db, 'exams', id), { isDeleted: true, status: 'ARCHIVED', updatedAt: Date.now() }, { merge: true });

    // Cascade cleanup: delete assignments and related attempts/drafts for this exam
    try {
      const assignmentsSnap = await getDocs(query(collection(db, 'assignments'), where('examId', '==', id)));
      const assignmentIds: string[] = assignmentsSnap.docs.map((d) => d.id);

      for (const assignmentDoc of assignmentsSnap.docs) {
        const assignmentId = assignmentDoc.id;

        // Delete attempts of this assignment
        const attemptsSnap = await getDocs(query(collection(db, 'attempts'), where('assignmentId', '==', assignmentId)));
        await Promise.all(attemptsSnap.docs.map((d) => deleteDoc(doc(db, 'attempts', d.id))));

        // Delete attempt drafts of this assignment
        const draftsSnap = await getDocs(query(collection(db, 'attemptDrafts'), where('assignmentId', '==', assignmentId)));
        await Promise.all(draftsSnap.docs.map((d) => deleteDoc(doc(db, 'attemptDrafts', d.id))));

        // Finally delete the assignment itself
        await deleteDoc(doc(db, 'assignments', assignmentId));
      }
    } catch (error) {
      console.error('Error cascading delete for exam:', error);
    }
  },
  getExamById: async (id: string): Promise<Exam | undefined> => {
    try {
      const d = await getDoc(doc(db, 'exams', id));
      if (!d.exists()) return undefined;
      const exam = d.data() as Exam;
      return exam.isDeleted ? undefined : exam;
    } catch (error) {
      console.error("Error getting exam:", error);
      return undefined;
    }
  },
  getExamVersions: async (examId: string): Promise<ExamVersion[]> => {
    try {
      const q = query(collection(db, 'exams'), where('parentExamId', '==', examId));
      const snapshot = await getDocs(q);
      return snapshot.docs
        .map(doc => doc.data() as Exam)
        .filter(exam => exam.isExamVersion)
        .map((examDoc) => ({
          id: examDoc.id,
          examId: examDoc.parentExamId || examId,
          teacherId: examDoc.teacherId,
          code: examDoc.versionCode || 'A',
          derivedExam: examDoc,
          mappings: examDoc.versionMappings || [],
          config: examDoc.versionConfig || examDoc.mixingSettings || {},
          createdAt: examDoc.createdAt,
        }))
        .sort((a, b) => a.code.localeCompare(b.code));
    } catch (error) {
      console.error("Error getting exam versions:", error);
      return [];
    }
  },
  getExamVersionById: async (id: string): Promise<ExamVersion | undefined> => {
    try {
      const d = await getDoc(doc(db, 'exams', id));
      if (!d.exists()) return undefined;
      const examDoc = d.data() as Exam;
      if (!examDoc.isExamVersion) return undefined;
      return {
        id: examDoc.id,
        examId: examDoc.parentExamId || '',
        teacherId: examDoc.teacherId,
        code: examDoc.versionCode || 'A',
        derivedExam: examDoc,
        mappings: examDoc.versionMappings || [],
        config: examDoc.versionConfig || examDoc.mixingSettings || {},
        createdAt: examDoc.createdAt,
      };
    } catch (error) {
      console.error("Error getting exam version:", error);
      return undefined;
    }
  },
  saveExamVersion: async (version: ExamVersion) => {
    await setDoc(doc(db, 'exams', version.id), {
      ...version.derivedExam,
      id: version.id,
      parentExamId: version.examId,
      isExamVersion: true,
      versionCode: version.code,
      versionMappings: version.mappings,
      versionConfig: version.config,
      createdAt: version.createdAt,
      updatedAt: Date.now(),
    } as Exam);
  },
  replaceExamVersions: async (examId: string, versions: ExamVersion[]) => {
    const existing = await store.getExamVersions(examId);
    await Promise.all(existing.map((version) => deleteDoc(doc(db, 'exams', version.id))));
    await Promise.all(versions.map((version) => store.saveExamVersion(version)));
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
  deleteAssignment: async (assignmentId: string) => {
    // Xóa tất cả attempts và drafts liên quan trước
    const [attemptsSnap, draftsSnap] = await Promise.all([
      getDocs(query(collection(db, 'attempts'), where('assignmentId', '==', assignmentId))),
      getDocs(query(collection(db, 'attemptDrafts'), where('assignmentId', '==', assignmentId))),
    ]);
    await Promise.all([
      ...attemptsSnap.docs.map(d => deleteDoc(doc(db, 'attempts', d.id))),
      ...draftsSnap.docs.map(d => deleteDoc(doc(db, 'attemptDrafts', d.id))),
    ]);
    await deleteDoc(doc(db, 'assignments', assignmentId));
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
  deleteAttempt: async (id: string) => {
    await deleteDoc(doc(db, 'attempts', id));
  },
  saveAttemptDraft: async (draft: AttemptDraft) => {
    await setDoc(doc(db, 'attemptDrafts', draft.id), draft);
  },
  getAttemptDraft: async (assignmentId: string, studentId: string): Promise<AttemptDraft | undefined> => {
    try {
      const draftId = `${assignmentId}_${studentId}`;
      const d = await getDoc(doc(db, 'attemptDrafts', draftId));
      return d.exists() ? (d.data() as AttemptDraft) : undefined;
    } catch (error) {
      console.error("Error getting attempt draft:", error);
      return undefined;
    }
  },
  deleteAttemptDraft: async (assignmentId: string, studentId: string) => {
    const draftId = `${assignmentId}_${studentId}`;
    await deleteDoc(doc(db, 'attemptDrafts', draftId));
  },
  resetStudentAttempt: async (assignmentId: string, studentId: string) => {
    // Delete all attempts for this student on this assignment
    const attemptsSnap = await getDocs(
      query(collection(db, 'attempts'),
        where('assignmentId', '==', assignmentId),
        where('studentId', '==', studentId))
    );
    await Promise.all(attemptsSnap.docs.map(d => deleteDoc(doc(db, 'attempts', d.id))));
    // Delete draft too
    const draftId = `${assignmentId}_${studentId}`;
    try { await deleteDoc(doc(db, 'attemptDrafts', draftId)); } catch (_) {}
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
      callback(snapshot.docs.map((doc: any) => doc.data() as Exam).filter((exam: Exam) => !exam.isDeleted && !exam.isExamVersion));
    }, (error: any) => console.error(error));
  },
  subscribeToExamVersions: (callback: (versions: ExamVersion[]) => void, examId: string) => {
    const q = query(collection(db, 'exams'), where('parentExamId', '==', examId));
    return onSnapshot(q, (snapshot: any) => {
      callback(
        snapshot.docs
          .map((doc: any) => doc.data() as Exam)
          .filter((exam: Exam) => exam.isExamVersion)
          .map((examDoc: Exam) => ({
            id: examDoc.id,
            examId: examDoc.parentExamId || examId,
            teacherId: examDoc.teacherId,
            code: examDoc.versionCode || 'A',
            derivedExam: examDoc,
            mappings: examDoc.versionMappings || [],
            config: examDoc.versionConfig || examDoc.mixingSettings || {},
            createdAt: examDoc.createdAt,
          }))
          .sort((a: ExamVersion, b: ExamVersion) => a.code.localeCompare(b.code))
      );
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
  subscribeToClassAttemptDrafts: (callback: (drafts: AttemptDraft[]) => void, classId: string) => {
    const q = query(collection(db, 'attemptDrafts'), where('classId', '==', classId));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => doc.data() as AttemptDraft));
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
  subscribeToTeacherAttemptDrafts: (callback: (drafts: AttemptDraft[]) => void, teacherAssignmentIds: string[]) => {
    if (teacherAssignmentIds.length === 0) {
      callback([]);
      return () => {};
    }

    const q = collection(db, 'attemptDrafts');
    return onSnapshot(q, (snapshot: any) => {
      const allDrafts = snapshot.docs.map((doc: any) => doc.data() as AttemptDraft);
      const filtered = allDrafts.filter(d => teacherAssignmentIds.includes(d.assignmentId));
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
