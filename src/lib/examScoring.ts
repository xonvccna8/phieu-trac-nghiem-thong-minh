import { Exam } from '../types';

export interface LegacyExamScoreBreakdown {
  p1Score: number;
  p2Score: number;
  p3Score: number;
  total: number;
  unansweredCount: number;
}

export interface LegacyExamAnswerSet {
  answersPart1: Record<number, string>;
  answersPart2: Record<number, Record<string, boolean>>;
  answersPart3: Record<number, string>;
}

export function calculateLegacyExamScore(
  exam: Exam | null | undefined,
  answers: LegacyExamAnswerSet
): LegacyExamScoreBreakdown {
  if (!exam) {
    return { p1Score: 0, p2Score: 0, p3Score: 0, total: 0, unansweredCount: 28 };
  }

  const { answersPart1, answersPart2, answersPart3 } = answers;
  let p1Score = 0;
  let p2Score = 0;
  let p3Score = 0;
  let unansweredCount = 0;

  for (let i = 1; i <= 18; i++) {
    if (!answersPart1[i]) {
      unansweredCount++;
      continue;
    }
    if (answersPart1[i] === exam.part1[i]?.answer) {
      p1Score += 0.25;
    }
  }

  for (let i = 1; i <= 4; i++) {
    const subAnswers = answersPart2[i] || {};
    const subs = ['a', 'b', 'c', 'd'];
    let correctCount = 0;
    let answeredSubCount = 0;

    subs.forEach((sub) => {
      if (subAnswers[sub] !== undefined) {
        answeredSubCount++;
      }
      if (subAnswers[sub] !== undefined && subAnswers[sub] === exam.part2[i]?.answers?.[sub]) {
        correctCount++;
      }
    });

    if (answeredSubCount === 0) {
      unansweredCount++;
    }

    if (correctCount === 1) p2Score += 0.1;
    else if (correctCount === 2) p2Score += 0.25;
    else if (correctCount === 3) p2Score += 0.5;
    else if (correctCount === 4) p2Score += 1.0;
  }

  for (let i = 1; i <= 6; i++) {
    const studentAns = (answersPart3[i] || '').trim().toLowerCase();
    const correctAns = (exam.part3[i]?.answer || '').trim().toLowerCase();

    if (!studentAns) {
      unansweredCount++;
      continue;
    }

    if (studentAns === correctAns) {
      p3Score += 0.25;
    }
  }

  return {
    p1Score,
    p2Score,
    p3Score,
    total: p1Score + p2Score + p3Score,
    unansweredCount,
  };
}

export function getLegacyExamQuestionCounts() {
  return {
    part1: 18,
    part2: 4,
    part2Subs: 4,
    part3: 6,
    totalPrimaryQuestions: 28,
  };
}
