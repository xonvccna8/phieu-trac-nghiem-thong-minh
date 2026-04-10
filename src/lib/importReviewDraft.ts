import type { ExamImportWarning, ExamTemplateType, Part1QuestionData, Part2QuestionData, Part3QuestionData } from '@/types';

export interface ImportReviewDraft {
  fileName: string;
  importedAt: number;
  sourceLabel: string;
  templateType: ExamTemplateType;
  title: string;
  subject: string;
  grade: string;
  description: string;
  instructions: string;
  durationMinutes: number;
  totalScore: number;
  maxAttempts: number;
  part1: Record<number, Part1QuestionData>;
  part2: Record<number, Part2QuestionData>;
  part3: Record<number, Part3QuestionData>;
  warnings: ExamImportWarning[];
}

const IMPORT_REVIEW_DRAFT_KEY = 'exam-import-review-draft';

export function saveImportReviewDraft(draft: ImportReviewDraft) {
  sessionStorage.setItem(IMPORT_REVIEW_DRAFT_KEY, JSON.stringify(draft));
}

export function loadImportReviewDraft(): ImportReviewDraft | null {
  const raw = sessionStorage.getItem(IMPORT_REVIEW_DRAFT_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as ImportReviewDraft;
  } catch (error) {
    console.error('Không thể đọc draft import review:', error);
    sessionStorage.removeItem(IMPORT_REVIEW_DRAFT_KEY);
    return null;
  }
}

export function clearImportReviewDraft() {
  sessionStorage.removeItem(IMPORT_REVIEW_DRAFT_KEY);
}
