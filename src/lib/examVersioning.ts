import {
  Attempt,
  Exam,
  ExamMixingSettings,
  ExamVersion,
  Part1QuestionData,
  Part2QuestionData,
  Part3QuestionData,
  QuestionOrderMapping,
} from '@/types';

type SeededRandom = () => number;

function createSeededRandom(seed: string): SeededRandom {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index++) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return () => {
    hash += 0x6D2B79F5;
    let t = hash;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleArray<T>(source: T[], random: SeededRandom): T[] {
  const arr = [...source];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getVersionCode(index: number, config: ExamMixingSettings) {
  if (config.codeStyle === 'NUMERIC') {
    return String(index + 1).padStart(4, '0');
  }

  let value = index;
  let code = '';
  do {
    code = String.fromCharCode(65 + (value % 26)) + code;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);
  return code;
}

function getOrderedNumbers<T>(record: Record<number, T>) {
  return Object.keys(record)
    .map(Number)
    .filter((value) => !Number.isNaN(value))
    .sort((a, b) => a - b);
}

function shuffleChoicesForQuestion(question: Part1QuestionData, random: SeededRandom) {
  const choiceKeys = ['A', 'B', 'C', 'D'];
  const shuffledKeys = shuffleArray(choiceKeys, random);
  const originalCorrect = (question.answer || '').toUpperCase();
  const newChoices: Record<string, string> = {};
  const choiceMappings: QuestionOrderMapping['choiceMappings'] = [];

  choiceKeys.forEach((targetLabel, index) => {
    const originalChoice = shuffledKeys[index];
    newChoices[targetLabel] = question.choices?.[originalChoice] || '';
    choiceMappings?.push({
      originalChoice,
      shuffledChoice: targetLabel,
      isCorrect: originalChoice === originalCorrect,
    });
  });

  const newCorrect = choiceMappings?.find((item) => item.isCorrect)?.shuffledChoice || originalCorrect;

  return {
    question: {
      ...question,
      choices: newChoices,
      answer: newCorrect,
    },
    originalCorrect,
    shuffledCorrect: newCorrect,
    choiceMappings,
  };
}

function shuffleStatementsForQuestion(question: Part2QuestionData, random: SeededRandom) {
  const statementKeys = ['a', 'b', 'c', 'd'];
  const shuffledKeys = shuffleArray(statementKeys, random);
  const newStatements: Record<string, string> = {};
  const newAnswers: Record<string, boolean> = {};
  const newExplanations: NonNullable<Part2QuestionData['explanations']> = {};
  const choiceMappings: QuestionOrderMapping['choiceMappings'] = [];

  statementKeys.forEach((targetLabel, index) => {
    const originalLabel = shuffledKeys[index];
    newStatements[targetLabel] = question.statements?.[originalLabel] || '';
    if (question.answers?.[originalLabel] !== undefined) {
      newAnswers[targetLabel] = question.answers[originalLabel];
    }
    if (question.explanations?.[originalLabel]) {
      newExplanations[targetLabel] = { ...question.explanations[originalLabel] };
    }
    choiceMappings?.push({
      originalChoice: originalLabel,
      shuffledChoice: targetLabel,
      isCorrect: question.answers?.[originalLabel] === true,
    });
  });

  return {
    question: {
      ...question,
      statements: newStatements,
      answers: newAnswers,
      explanations: newExplanations,
    },
    choiceMappings,
  };
}

export function generateExamVersions(
  exam: Exam,
  teacherId: string,
  config: ExamMixingSettings
): ExamVersion[] {
  const normalizedConfig: ExamMixingSettings = {
    enabled: true,
    versionCount: Math.max(1, Math.min(20, config.versionCount || 1)),
    codeStyle: config.codeStyle || 'ALPHA',
    shuffleQuestions: config.shuffleQuestions ?? true,
    shuffleChoices: config.shuffleChoices ?? true,
    keepPartOrder: config.keepPartOrder ?? true,
    shuffleWithinPartOnly: config.shuffleWithinPartOnly ?? true,
    keepPart3Fixed: config.keepPart3Fixed ?? true,
  };

  const part1Numbers = getOrderedNumbers(exam.part1);
  const part2Numbers = getOrderedNumbers(exam.part2);
  const part3Numbers = getOrderedNumbers(exam.part3);

  return Array.from({ length: normalizedConfig.versionCount || 1 }).map((_, index) => {
    const code = getVersionCode(index, normalizedConfig);
    const random = createSeededRandom(`${exam.id}-${code}`);

    const versionPart1Order = normalizedConfig.shuffleQuestions ? shuffleArray(part1Numbers, random) : [...part1Numbers];
    const versionPart2Order = normalizedConfig.shuffleQuestions ? shuffleArray(part2Numbers, random) : [...part2Numbers];
    const versionPart3Order =
      normalizedConfig.shuffleQuestions && !normalizedConfig.keepPart3Fixed ? shuffleArray(part3Numbers, random) : [...part3Numbers];

    const derivedPart1: Record<number, Part1QuestionData> = {};
    const derivedPart2: Record<number, Part2QuestionData> = {};
    const derivedPart3: Record<number, Part3QuestionData> = {};
    const mappings: QuestionOrderMapping[] = [];

    versionPart1Order.forEach((originalQuestionNumber, displayIndex) => {
      const versionQuestionNumber = displayIndex + 1;
      const sourceQuestion = exam.part1[originalQuestionNumber];
      const shuffled = normalizedConfig.shuffleChoices
        ? shuffleChoicesForQuestion(sourceQuestion, random)
        : {
            question: { ...sourceQuestion },
            originalCorrect: sourceQuestion.answer || '',
            shuffledCorrect: sourceQuestion.answer || '',
            choiceMappings: ['A', 'B', 'C', 'D'].map((choice) => ({
              originalChoice: choice,
              shuffledChoice: choice,
              isCorrect: (sourceQuestion.answer || '').toUpperCase() === choice,
            })),
          };

      derivedPart1[versionQuestionNumber] = shuffled.question;
      mappings.push({
        part: 1,
        originalQuestionNumber,
        versionQuestionNumber,
        originalCorrectAnswer: shuffled.originalCorrect,
        shuffledCorrectAnswer: shuffled.shuffledCorrect,
        choiceMappings: shuffled.choiceMappings,
      });
    });

    versionPart2Order.forEach((originalQuestionNumber, displayIndex) => {
      const versionQuestionNumber = displayIndex + 1;
      const sourceQuestion = exam.part2[originalQuestionNumber];
      const shuffled = normalizedConfig.shuffleChoices
        ? shuffleStatementsForQuestion(sourceQuestion, random)
        : {
            question: { ...sourceQuestion },
            choiceMappings: ['a', 'b', 'c', 'd'].map((choice) => ({
              originalChoice: choice,
              shuffledChoice: choice,
              isCorrect: sourceQuestion.answers?.[choice] === true,
            })),
          };

      derivedPart2[versionQuestionNumber] = shuffled.question;
      mappings.push({
        part: 2,
        originalQuestionNumber,
        versionQuestionNumber,
        choiceMappings: shuffled.choiceMappings,
      });
    });

    versionPart3Order.forEach((originalQuestionNumber, displayIndex) => {
      const versionQuestionNumber = displayIndex + 1;
      derivedPart3[versionQuestionNumber] = { ...exam.part3[originalQuestionNumber] };
      mappings.push({
        part: 3,
        originalQuestionNumber,
        versionQuestionNumber,
      });
    });

    const derivedExam: Exam = {
      ...exam,
      id: `${exam.id}__${code}`,
      title: `${exam.title} - Mã đề ${code}`,
      part1: derivedPart1,
      part2: derivedPart2,
      part3: derivedPart3,
      mixingSettings: normalizedConfig,
      updatedAt: Date.now(),
    };

    return {
      id: `${exam.id}_${code}`,
      examId: exam.id,
      teacherId,
      code,
      derivedExam,
      mappings,
      config: normalizedConfig,
      createdAt: Date.now(),
    };
  });
}

export function mapVersionAnswersToOriginal(
  version: ExamVersion | null | undefined,
  attemptAnswers: Pick<Attempt, 'answersPart1' | 'answersPart2' | 'answersPart3'>
) {
  if (!version) {
    return attemptAnswers;
  }

  const normalized = {
    answersPart1: {} as Record<number, string>,
    answersPart2: {} as Record<number, Record<string, boolean>>,
    answersPart3: {} as Record<number, string>,
  };

  version.mappings.forEach((mapping) => {
    if (mapping.part === 1) {
      const selected = attemptAnswers.answersPart1[mapping.versionQuestionNumber];
      if (!selected) return;
      const originalChoice = mapping.choiceMappings?.find((item) => item.shuffledChoice === selected)?.originalChoice || selected;
      normalized.answersPart1[mapping.originalQuestionNumber] = originalChoice;
    }

    if (mapping.part === 2) {
      const versionAnswers = attemptAnswers.answersPart2[mapping.versionQuestionNumber] || {};
      const originalAnswers: Record<string, boolean> = {};
      Object.entries(versionAnswers).forEach(([shuffledLabel, value]) => {
        const originalLabel = mapping.choiceMappings?.find((item) => item.shuffledChoice === shuffledLabel)?.originalChoice || shuffledLabel;
        originalAnswers[originalLabel] = value;
      });
      normalized.answersPart2[mapping.originalQuestionNumber] = originalAnswers;
    }

    if (mapping.part === 3) {
      normalized.answersPart3[mapping.originalQuestionNumber] = attemptAnswers.answersPart3[mapping.versionQuestionNumber] || '';
    }
  });

  return normalized;
}

export function pickDeterministicExamVersion(
  versions: ExamVersion[],
  studentId: string,
  assignmentId: string
) {
  if (!versions.length) return null;
  const ordered = [...versions].sort((a, b) => a.code.localeCompare(b.code));
  const random = createSeededRandom(`${assignmentId}-${studentId}`);
  const index = Math.floor(random() * ordered.length);
  return ordered[index];
}
