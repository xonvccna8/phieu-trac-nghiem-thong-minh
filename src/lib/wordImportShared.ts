import { ExamImportWarning, ExamTemplateType, Part1QuestionData, Part2QuestionData, Part3QuestionData } from '../types.js';

export interface ParsedWordExam {
  title: string;
  subject: string;
  grade: string;
  description: string;
  instructions: string;
  templateType: ExamTemplateType;
  durationMinutes: number;
  totalScore: number;
  maxAttempts: number;
  part1: Record<number, Part1QuestionData>;
  part2: Record<number, Part2QuestionData>;
  part3: Record<number, Part3QuestionData>;
  warnings: ExamImportWarning[];
}

export const normalizeNewlines = (text: string) => text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

export const cleanValue = (text: string) =>
  normalizeNewlines(text)
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();

const LABEL_PATTERN = /^([A-Z0-9_]+):\s*(.*)$/gm;

export function parseLabelMap(text: string) {
  const normalized = normalizeNewlines(text);
  const matches = [...normalized.matchAll(LABEL_PATTERN)];
  const result: Record<string, string> = {};

  matches.forEach((match, index) => {
    const label = match[1];
    const start = match.index ?? 0;
    const lineStart = start + match[0].length;
    const nextStart = matches[index + 1]?.index ?? normalized.length;
    const inlineValue = match[2]?.trim() || '';
    const multilineValue = normalized.slice(lineStart, nextStart).trim();
    result[label] = cleanValue([inlineValue, multilineValue].filter(Boolean).join('\n'));
  });

  return result;
}

export function parseInlineChoiceMap(text: string) {
  const result: Record<string, string> = {};
  const regex = /\b([ABCD]):\s*([\s\S]*?)(?=(?:\s+[ABCD]:)|(?:\n[A-Z0-9_]+:)|$)/g;
  for (const match of text.matchAll(regex)) {
    result[match[1]] = cleanValue(match[2] || '');
  }
  return result;
}

export function extractSection(text: string, sectionName: string) {
  const escaped = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\[${escaped}\\]([\\s\\S]*?)(?=\\n\\[[A-Z0-9_]+\\]|$)`, 'm');
  const match = normalizeNewlines(text).match(regex);
  return cleanValue(match?.[1] || '');
}

export function parseQuestionBlocks(sectionText: string) {
  const normalized = normalizeNewlines(sectionText);
  const regex = /^CAU\s+(\d+)\s*:\s*$/gm;
  const matches = [...normalized.matchAll(regex)];

  return matches.map((match, index) => {
    const qNum = Number(match[1]);
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? normalized.length;
    return { qNum, body: cleanValue(normalized.slice(start, end)) };
  });
}

export function normalizeBool(value: string | undefined) {
  const normalized = (value || '').trim().toUpperCase();
  if (['DUNG', 'TRUE', '1', 'CO', 'YES'].includes(normalized)) return true;
  if (['SAI', 'FALSE', '0', 'KHONG', 'NO'].includes(normalized)) return false;
  return undefined;
}

export function normalizeTemplateType(value: string | undefined): ExamTemplateType {
  const normalized = (value || '').trim().toUpperCase();
  return normalized === 'LEGACY_PHIU_TRA_LOI' ? 'LEGACY_PHIU_TRA_LOI' : 'ONLINE_EXAM';
}

export function pushWarning(
  warnings: ExamImportWarning[],
  level: ExamImportWarning['level'],
  message: string,
  questionRef?: string
) {
  warnings.push({
    id: `${level}-${questionRef || 'global'}-${warnings.length + 1}`,
    level,
    message,
    questionRef,
  });
}

export function parseExamFromWordText(rawText: string): ParsedWordExam {
  const text = normalizeNewlines(rawText);
  const warnings: ExamImportWarning[] = [];

  const infoText = extractSection(text, 'THONG_TIN');
  const part1Text = extractSection(text, 'PHAN_1');
  const part2Text = extractSection(text, 'PHAN_2');
  const part3Text = extractSection(text, 'PHAN_3');

  if (!infoText) {
    throw new Error('Không tìm thấy khối [THONG_TIN] trong file Word. Hãy dùng đúng mẫu chuẩn của hệ thống.');
  }

  const info = parseLabelMap(infoText);
  const part1: Record<number, Part1QuestionData> = {};
  const part2: Record<number, Part2QuestionData> = {};
  const part3: Record<number, Part3QuestionData> = {};

  parseQuestionBlocks(part1Text).forEach(({ qNum, body }) => {
    const labels = parseLabelMap(body);
    const inlineChoices = parseInlineChoiceMap(body);
    const answer = (labels.DAP_AN || '').trim().toUpperCase();
    part1[qNum] = {
      question: labels.NOI_DUNG || '',
      choices: {
        A: labels.A || inlineChoices.A || '',
        B: labels.B || inlineChoices.B || '',
        C: labels.C || inlineChoices.C || '',
        D: labels.D || inlineChoices.D || '',
      },
      answer,
      explanation: labels.LOI_GIAI || '',
      hint: labels.GOI_Y || '',
      similarExercise: labels.CAU_TUONG_TU || labels.DAP_AN_TUONG_TU
        ? {
            question: labels.CAU_TUONG_TU || '',
            answer: labels.DAP_AN_TUONG_TU || '',
          }
        : undefined,
    };

    if (!answer) pushWarning(warnings, 'warning', `Phần I - Câu ${qNum} chưa có đáp án đúng.`, `P1-${qNum}`);
    if (answer && !['A', 'B', 'C', 'D'].includes(answer)) {
      pushWarning(warnings, 'error', `Phần I - Câu ${qNum} có đáp án không hợp lệ: ${answer}. Chỉ chấp nhận A/B/C/D.`, `P1-${qNum}`);
    }
  });

  parseQuestionBlocks(part2Text).forEach(({ qNum, body }) => {
    const labels = parseLabelMap(body);
    const answers: Record<string, boolean> = {};
    const explanations: NonNullable<Part2QuestionData['explanations']> = {};

    ['a', 'b', 'c', 'd'].forEach((label) => {
      const answer = normalizeBool(labels[`DAP_AN_${label}`]);
      if (answer !== undefined) answers[label] = answer;

      const explanation = labels[`LOI_GIAI_${label}`] || '';
      const hint = labels[`GOI_Y_${label}`] || '';
      const similarQuestion = labels[`CAU_TUONG_TU_${label}`] || '';
      const similarAnswer = labels[`DAP_AN_TUONG_TU_${label}`] || '';

      if (explanation || hint || similarQuestion || similarAnswer) {
        explanations[label] = {
          explanation,
          hint,
          similarExercise: similarQuestion || similarAnswer
            ? { question: similarQuestion, answer: similarAnswer }
            : undefined,
        };
      }

      if (labels[`DAP_AN_${label}`] && answer === undefined) {
        pushWarning(warnings, 'error', `Phần II - Câu ${qNum} - ý ${label} có đáp án không hợp lệ. Dùng DUNG hoặc SAI.`, `P2-${qNum}-${label}`);
      }
    });

    part2[qNum] = {
      question: labels.NOI_DUNG || '',
      statements: {
        a: labels.a || '',
        b: labels.b || '',
        c: labels.c || '',
        d: labels.d || '',
      },
      answers,
      explanations,
      explanation: labels.LOI_GIAI || '',
      hint: labels.GOI_Y || '',
    };
  });

  parseQuestionBlocks(part3Text).forEach(({ qNum, body }) => {
    const labels = parseLabelMap(body);
    part3[qNum] = {
      question: labels.NOI_DUNG || '',
      answer: labels.DAP_AN || '',
      explanation: labels.LOI_GIAI || '',
      hint: labels.GOI_Y || '',
      similarExercise: labels.CAU_TUONG_TU || labels.DAP_AN_TUONG_TU
        ? {
            question: labels.CAU_TUONG_TU || '',
            answer: labels.DAP_AN_TUONG_TU || '',
          }
        : undefined,
    };

    if (!labels.DAP_AN) {
      pushWarning(warnings, 'warning', `Phần III - Câu ${qNum} chưa có đáp án đúng.`, `P3-${qNum}`);
    }
  });

  const result: ParsedWordExam = {
    title: info.TIEU_DE || '',
    subject: info.MON_HOC || '',
    grade: info.KHOI_LOP || '',
    description: info.MO_TA || '',
    instructions: info.HUONG_DAN || '',
    templateType: normalizeTemplateType(info.LOAI_DE),
    durationMinutes: Math.max(1, Number(info.THOI_GIAN || 50) || 50),
    totalScore: Math.max(1, Number(info.TONG_DIEM || 10) || 10),
    maxAttempts: Math.max(1, Number(info.SO_LAN_LAM || 1) || 1),
    part1,
    part2,
    part3,
    warnings,
  };

  if (!result.title.trim()) {
    pushWarning(warnings, 'error', 'Thiếu trường TIEU_DE trong phần [THONG_TIN].');
  }

  if (!Object.keys(part1).length && !Object.keys(part2).length && !Object.keys(part3).length) {
    throw new Error('Không tìm thấy câu hỏi nào trong file Word. Hãy kiểm tra các khối [PHAN_1], [PHAN_2], [PHAN_3].');
  }

  return result;
}
