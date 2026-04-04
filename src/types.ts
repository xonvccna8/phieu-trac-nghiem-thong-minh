export type QuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_ANSWER';

export interface Class {
  id: string;
  name: string;
  teacherId: string;
  createdAt: number;
}

export interface Exam {
  id: string;
  title: string;
  teacherId: string;
  part1: Record<number, { answer?: string, explanation?: string, hint?: string }>;
  part2: Record<number, { 
    answers: Record<string, boolean>;
    explanations?: Record<string, { explanation?: string, hint?: string }>;
    // Keep these for backward compatibility if needed, but we'll use explanations[sub] going forward
    explanation?: string; 
    hint?: string;
  }>;
  part3: Record<number, { answer?: string, explanation?: string, hint?: string }>;
  createdAt: number;
}

export interface Assignment {
  id: string;
  examId: string;
  classId: string;
  teacherId: string;
  mode: 'EXAM' | 'PRACTICE';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  startDate?: string;
  dueDate: string;
  maxAttempts?: number;
  createdAt: number;
}

export interface Attempt {
  id: string;
  assignmentId: string;
  studentId: string;
  classId?: string; // Optional for backward compatibility with old data
  teacherId?: string; // Optional for backward compatibility with old data
  answersPart1: Record<number, string>;
  answersPart2: Record<number, Record<string, boolean>>;
  answersPart3: Record<number, string>;
  score: number;
  part1Score: number;
  part2Score: number;
  part3Score: number;
  submittedAt: number;
}

export interface User {
  uid: string;
  email: string;
  role: 'TEACHER' | 'STUDENT';
  fullName: string;
  createdAt: number;
}

export interface Student {
  id: string; // This will now match the Auth UID
  sbd: string; // 6 digits
  fullName: string;
  classId: string;
  teacherId: string;
  createdAt: number;
}
