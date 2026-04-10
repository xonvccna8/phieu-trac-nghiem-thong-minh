import { Assignment, Exam } from '../types';

export function getExamAvailability(exam: Exam | null | undefined, assignment: Assignment | null | undefined) {
  const now = new Date();
  const startsAt = assignment?.startDate ? new Date(assignment.startDate) : null;
  const endsAt = assignment?.dueDate ? new Date(assignment.dueDate) : null;

  if (!exam || exam.isDeleted) {
    return { allowed: false, reason: 'Đề thi không còn khả dụng.' };
  }

  if (exam.status === 'LOCKED' || exam.status === 'ARCHIVED') {
    return { allowed: false, reason: 'Đề thi hiện đang bị khóa.' };
  }

  if (startsAt && now < startsAt) {
    return {
      allowed: false,
      reason: `Chưa đến thời gian làm bài. Bài sẽ mở lúc ${assignment?.startDate?.replace('T', ' ') || ''}.`,
    };
  }

  if (endsAt && now > endsAt) {
    return {
      allowed: false,
      reason: `Bài thi đã quá hạn. Hạn nộp là ${assignment?.dueDate?.replace('T', ' ') || ''}.`,
    };
  }

  return { allowed: true, reason: '' };
}

export function getExamDurationInSeconds(exam: Exam | null | undefined) {
  const minutes = exam?.onlineSettings?.durationMinutes || 50;
  return Math.max(1, minutes) * 60;
}
