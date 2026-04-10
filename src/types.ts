export type QuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_ANSWER';
export type ExamStatus = 'DRAFT' | 'PUBLISHED' | 'LOCKED' | 'ARCHIVED';
export type ExamTemplateType = 'LEGACY_PHIU_TRA_LOI' | 'ONLINE_EXAM';
export type ImportSourceType = 'MANUAL' | 'WORD';
export type ExamVersionCodeStyle = 'ALPHA' | 'NUMERIC';

export interface Class {
  id: string;
  name: string;
  teacherId: string;
  createdAt: number;
}

export interface SimilarExercise {
  question: string; // Nội dung câu hỏi tương tự
  answer: string;   // Đáp án đúng (A/B/C/D, True/False, hoặc dạng text)
}

export interface ExamImportWarning {
  id: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  questionRef?: string;
}

export interface ExamImportSource {
  type: ImportSourceType;
  fileName?: string;
  importedAt?: number;
  warnings?: ExamImportWarning[];
}

export interface OnlineExamSettings {
  durationMinutes?: number;
  totalScore?: number;
  allowMultipleAttempts?: boolean;
  maxAttempts?: number;
  showScoreImmediately?: boolean;
  showAnswersAfterSubmit?: boolean;
  shuffleQuestions?: boolean;
  shuffleChoices?: boolean;
  requirePassword?: boolean;
  password?: string;
  autoSubmitWhenTimeUp?: boolean;
  allowReviewAfterSubmit?: boolean;
}

export interface ExamMixingSettings {
  enabled?: boolean;
  versionCount?: number;
  codeStyle?: ExamVersionCodeStyle;
  shuffleQuestions?: boolean;
  shuffleChoices?: boolean;
  keepPartOrder?: boolean;
  shuffleWithinPartOnly?: boolean;
  keepPart3Fixed?: boolean;
}

export interface Part1QuestionData {
  question?: string;
  choices?: Record<string, string>;
  answer?: string;
  explanation?: string;
  hint?: string;
  similarExercise?: SimilarExercise;
}

export interface Part2QuestionData {
  question?: string;
  statements?: Record<string, string>;
  answers: Record<string, boolean>;
  explanations?: Record<string, { explanation?: string, hint?: string, similarExercise?: SimilarExercise }>;
  explanation?: string;
  hint?: string;
}

export interface Part3QuestionData {
  question?: string;
  answer?: string;
  explanation?: string;
  hint?: string;
  similarExercise?: SimilarExercise;
}

export interface Exam {
  id: string;
  title: string;
  teacherId: string;
  part1: Record<number, Part1QuestionData>;
  part2: Record<number, Part2QuestionData>;
  part3: Record<number, Part3QuestionData>;
  status?: ExamStatus;
  templateType?: ExamTemplateType;
  subject?: string;
  grade?: string;
  description?: string;
  instructions?: string;
  onlineSettings?: OnlineExamSettings;
  mixingSettings?: ExamMixingSettings;
  parentExamId?: string;
  isExamVersion?: boolean;
  versionCode?: string;
  versionMappings?: QuestionOrderMapping[];
  versionConfig?: ExamMixingSettings;
  importSource?: ExamImportSource;
  isDeleted?: boolean;
  updatedAt?: number;
  createdAt: number;
}

export interface ChoiceMapping {
  originalChoice: string;
  shuffledChoice: string;
  isCorrect: boolean;
}

export interface QuestionOrderMapping {
  part: 1 | 2 | 3;
  originalQuestionNumber: number;
  versionQuestionNumber: number;
  originalCorrectAnswer?: string;
  shuffledCorrectAnswer?: string;
  choiceMappings?: ChoiceMapping[];
}

export interface ExamVersion {
  id: string;
  examId: string;
  teacherId: string;
  code: string;
  derivedExam: Exam;
  mappings: QuestionOrderMapping[];
  config: ExamMixingSettings;
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
  examStatusSnapshot?: ExamStatus;
  titleSnapshot?: string;
  subjectSnapshot?: string;
  durationMinutesSnapshot?: number;
  showScoreImmediately?: boolean;
  showAnswersAfterSubmit?: boolean;
  passwordRequired?: boolean;
  versioningEnabled?: boolean;
  mixedVersionCountSnapshot?: number;
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
  unansweredCount?: number;
  startedAt?: number;
  durationSeconds?: number;
  autoSubmitted?: boolean;
  tabSwitchCount?: number;
  examVersionId?: string;
  examVersionCode?: string;
  submittedAt: number;
}

export interface AttemptDraft {
  id: string;
  assignmentId: string;
  studentId: string;
  classId?: string;
  teacherId?: string;
  answersPart1: Record<number, string>;
  answersPart2: Record<number, Record<string, boolean>>;
  answersPart3: Record<number, string>;
  startedAt: number;
  updatedAt: number;
  tabSwitchCount?: number;
  examVersionId?: string;
  examVersionCode?: string;
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
