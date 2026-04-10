import mammoth from 'mammoth';
import { type ParsedWordExam, pushWarning } from '../src/lib/wordImportShared.js';
import { inspectDocxSemantics } from '../src/lib/docxSemantics.js';
import { solveQuestionWithAI } from './aiSolveService.js';

type AiTemplateType = 'ONLINE_EXAM' | 'LEGACY_PHIU_TRA_LOI';

interface AiPart1Question {
  questionNumber: number;
  question: string;
  choices: { A: string; B: string; C: string; D: string };
  answer: string;
  explanation: string;
  hint: string;
}

interface AiPart2Question {
  questionNumber: number;
  question: string;
  statements: { a: string; b: string; c: string; d: string };
  answers: { a: boolean | null; b: boolean | null; c: boolean | null; d: boolean | null };
  explanation: string;
  hint: string;
}

interface AiPart3Question {
  questionNumber: number;
  question: string;
  answer: string;
  explanation: string;
  hint: string;
}

interface AiNormalizedExam {
  title: string;
  subject: string;
  grade: string;
  description: string;
  instructions: string;
  templateType: AiTemplateType;
  durationMinutes: number;
  totalScore: number;
  maxAttempts: number;
  part1: AiPart1Question[];
  part2: AiPart2Question[];
  part3: AiPart3Question[];
  reviewNotes: string[];
}

interface EmbeddedAsset {
  token: string;
  html: string;
}

interface AiRepairPart1Question {
  question: string;
  choices: { A: string; B: string; C: string; D: string };
  answer: string;
  explanation: string;
  hint: string;
  confidenceNote: string;
}

export interface NormalizeWordImportInput {
  fileName: string;
  base64: string;
}

export interface NormalizeWordImportResult {
  parsedExam: ParsedWordExam;
  normalizedTemplateText: string;
  extractedTextPreview: string;
  usedAi: boolean;
  model: string;
}

const OPENAI_MODEL = 'gpt-5.4-mini';

function requireDocx(fileName: string) {
  if (!fileName.toLowerCase().endsWith('.docx')) {
    throw new Error('Hiện tại AI import hỗ trợ ổn định cho file .docx. Với file .doc cũ, hãy lưu lại thành .docx rồi tải lên.');
  }
}

function normalizeLineValue(value: string | number | undefined) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
}

function escapeHtmlAttribute(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function createEmbeddedAssetConverter(assets: EmbeddedAsset[]) {
  return async (image: any) => {
    const base64 = await image.readAsBase64String();
    const contentType = image.contentType || 'image/png';
    const token = `[WORD_IMAGE_${assets.length + 1}]`;
    const src = `data:${contentType};base64,${base64}`;

    assets.push({
      token,
      html: `<img src="${escapeHtmlAttribute(src)}" alt="${escapeHtmlAttribute(token)}" class="word-import-image" />`,
    });

    return {
      src: `word-image://${token}`,
      alt: token,
      'data-word-image-token': token,
    };
  };
}

function injectAssetTokensIntoHtml(html: string, assets: EmbeddedAsset[]) {
  return assets.reduce((result, asset) => {
    const escapedToken = asset.token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const srcPattern = `word-image://${escapedToken}`;
    return result.replace(
      new RegExp(`<img([^>]*?)src="${srcPattern}"([^>]*?)>`, 'g'),
      `<span data-word-image-inline="${asset.token}">${asset.token}</span>`
    );
  }, html);
}

function restoreEmbeddedAssetsInText(value: string, assets: EmbeddedAsset[]) {
  if (!value) return '';

  return assets.reduce((result, asset) => {
    const tokenPattern = asset.token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    return result
      .replace(new RegExp(`word-image://${tokenPattern}`, 'g'), asset.html)
      .replace(new RegExp(`<img[^>]*data-word-image-token="${tokenPattern}"[^>]*>`, 'g'), asset.html)
      .replace(new RegExp(`<span[^>]*data-word-image-inline="${tokenPattern}"[^>]*>${tokenPattern}</span>`, 'g'), asset.html)
      .replace(new RegExp(tokenPattern, 'g'), asset.html);
  }, value);
}

function restoreEmbeddedAssetsInNormalizedExam(normalized: AiNormalizedExam, assets: EmbeddedAsset[]): AiNormalizedExam {
  return {
    ...normalized,
    title: restoreEmbeddedAssetsInText(normalized.title, assets),
    subject: restoreEmbeddedAssetsInText(normalized.subject, assets),
    grade: restoreEmbeddedAssetsInText(normalized.grade, assets),
    description: restoreEmbeddedAssetsInText(normalized.description, assets),
    instructions: restoreEmbeddedAssetsInText(normalized.instructions, assets),
    reviewNotes: normalized.reviewNotes.map((note) => restoreEmbeddedAssetsInText(note, assets)),
    part1: normalized.part1.map((question) => ({
      ...question,
      question: restoreEmbeddedAssetsInText(question.question, assets),
      choices: {
        A: restoreEmbeddedAssetsInText(question.choices?.A || '', assets),
        B: restoreEmbeddedAssetsInText(question.choices?.B || '', assets),
        C: restoreEmbeddedAssetsInText(question.choices?.C || '', assets),
        D: restoreEmbeddedAssetsInText(question.choices?.D || '', assets),
      },
      answer: restoreEmbeddedAssetsInText(question.answer, assets),
      explanation: restoreEmbeddedAssetsInText(question.explanation, assets),
      hint: restoreEmbeddedAssetsInText(question.hint, assets),
    })),
    part2: normalized.part2.map((question) => ({
      ...question,
      question: restoreEmbeddedAssetsInText(question.question, assets),
      statements: {
        a: restoreEmbeddedAssetsInText(question.statements?.a || '', assets),
        b: restoreEmbeddedAssetsInText(question.statements?.b || '', assets),
        c: restoreEmbeddedAssetsInText(question.statements?.c || '', assets),
        d: restoreEmbeddedAssetsInText(question.statements?.d || '', assets),
      },
      explanation: restoreEmbeddedAssetsInText(question.explanation, assets),
      hint: restoreEmbeddedAssetsInText(question.hint, assets),
    })),
    part3: normalized.part3.map((question) => ({
      ...question,
      question: restoreEmbeddedAssetsInText(question.question, assets),
      answer: restoreEmbeddedAssetsInText(question.answer, assets),
      explanation: restoreEmbeddedAssetsInText(question.explanation, assets),
      hint: restoreEmbeddedAssetsInText(question.hint, assets),
    })),
  };
}

function normalizeForLookup(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function extractQuestionSnippet(source: string, questionNumber: number, radius = 5000) {
  if (!source) return '';

  const normalized = normalizeForLookup(source);
  const labels = [`cau ${questionNumber}`, `câu ${questionNumber}`];
  let foundIndex = -1;

  for (const label of labels) {
    foundIndex = normalized.indexOf(normalizeForLookup(label));
    if (foundIndex >= 0) break;
  }

  if (foundIndex < 0) {
    return source.slice(0, Math.min(source.length, radius));
  }

  const endLabelNormalized = normalizeForLookup(`cau ${questionNumber + 1}`);
  const endIndex = normalized.indexOf(endLabelNormalized, foundIndex + 1);
  const start = Math.max(0, foundIndex - Math.floor(radius / 3));
  const end = endIndex >= 0 ? Math.min(source.length, endIndex + Math.floor(radius / 6)) : Math.min(source.length, foundIndex + radius);

  return source.slice(start, end);
}

function hasMissingPart1Content(question: AiPart1Question) {
  return !normalizeLineValue(question.choices?.A)
    || !normalizeLineValue(question.choices?.B)
    || !normalizeLineValue(question.choices?.C)
    || !normalizeLineValue(question.choices?.D)
    || !normalizeLineValue(question.answer)
    || !normalizeLineValue(question.explanation);
}

function boolToWord(value: boolean | null | undefined) {
  if (value === true) return 'DUNG';
  if (value === false) return 'SAI';
  return '';
}

function buildTemplateText(normalized: AiNormalizedExam) {
  const lines: string[] = [
    '[THONG_TIN]',
    `TIEU_DE: ${normalizeLineValue(normalized.title)}`,
    `MON_HOC: ${normalizeLineValue(normalized.subject)}`,
    `KHOI_LOP: ${normalizeLineValue(normalized.grade)}`,
    `LOAI_DE: ${normalizeLineValue(normalized.templateType || 'ONLINE_EXAM')}`,
    `THOI_GIAN: ${Number(normalized.durationMinutes) || 50}`,
    `TONG_DIEM: ${Number(normalized.totalScore) || 10}`,
    `SO_LAN_LAM: ${Number(normalized.maxAttempts) || 1}`,
    `MO_TA: ${normalizeLineValue(normalized.description)}`,
    `HUONG_DAN: ${normalizeLineValue(normalized.instructions)}`,
    '',
    '[PHAN_1]',
  ];

  normalized.part1
    .sort((a, b) => a.questionNumber - b.questionNumber)
    .forEach((question, index) => {
      const qNum = question.questionNumber || index + 1;
      lines.push(`CAU ${qNum}:`);
      lines.push(`NOI_DUNG: ${normalizeLineValue(question.question)}`);
      lines.push(`A: ${normalizeLineValue(question.choices?.A)}`);
      lines.push(`B: ${normalizeLineValue(question.choices?.B)}`);
      lines.push(`C: ${normalizeLineValue(question.choices?.C)}`);
      lines.push(`D: ${normalizeLineValue(question.choices?.D)}`);
      lines.push(`DAP_AN: ${normalizeLineValue(question.answer).toUpperCase()}`);
      lines.push(`LOI_GIAI: ${normalizeLineValue(question.explanation)}`);
      lines.push(`GOI_Y: ${normalizeLineValue(question.hint)}`);
      lines.push('');
    });

  lines.push('[PHAN_2]');
  normalized.part2
    .sort((a, b) => a.questionNumber - b.questionNumber)
    .forEach((question, index) => {
      const qNum = question.questionNumber || index + 1;
      lines.push(`CAU ${qNum}:`);
      lines.push(`NOI_DUNG: ${normalizeLineValue(question.question)}`);
      lines.push(`a: ${normalizeLineValue(question.statements?.a)}`);
      lines.push(`b: ${normalizeLineValue(question.statements?.b)}`);
      lines.push(`c: ${normalizeLineValue(question.statements?.c)}`);
      lines.push(`d: ${normalizeLineValue(question.statements?.d)}`);
      lines.push(`DAP_AN_a: ${boolToWord(question.answers?.a)}`);
      lines.push(`DAP_AN_b: ${boolToWord(question.answers?.b)}`);
      lines.push(`DAP_AN_c: ${boolToWord(question.answers?.c)}`);
      lines.push(`DAP_AN_d: ${boolToWord(question.answers?.d)}`);
      lines.push(`LOI_GIAI: ${normalizeLineValue(question.explanation)}`);
      lines.push(`GOI_Y: ${normalizeLineValue(question.hint)}`);
      lines.push('');
    });

  lines.push('[PHAN_3]');
  normalized.part3
    .sort((a, b) => a.questionNumber - b.questionNumber)
    .forEach((question, index) => {
      const qNum = question.questionNumber || index + 1;
      lines.push(`CAU ${qNum}:`);
      lines.push(`NOI_DUNG: ${normalizeLineValue(question.question)}`);
      lines.push(`DAP_AN: ${normalizeLineValue(question.answer)}`);
      lines.push(`LOI_GIAI: ${normalizeLineValue(question.explanation)}`);
      lines.push(`GOI_Y: ${normalizeLineValue(question.hint)}`);
      lines.push('');
    });

  return lines.join('\n').trim();
}

function toParsedExam(normalized: AiNormalizedExam): ParsedWordExam {
  const warnings = [];

  const part1 = Object.fromEntries(
    normalized.part1
      .sort((a, b) => a.questionNumber - b.questionNumber)
      .map((question, index) => {
        const qNum = question.questionNumber || index + 1;
        const answer = normalizeLineValue(question.answer).toUpperCase();

        if (!answer) {
          pushWarning(warnings, 'warning', `Phần I - Câu ${qNum} chưa có đáp án đúng sau khi AI chuẩn hóa.`, `P1-${qNum}`);
        } else if (!['A', 'B', 'C', 'D'].includes(answer)) {
          pushWarning(warnings, 'error', `Phần I - Câu ${qNum} có đáp án không hợp lệ sau khi AI chuẩn hóa: ${answer}.`, `P1-${qNum}`);
        }

        return [qNum, {
          question: normalizeLineValue(question.question),
          choices: {
            A: normalizeLineValue(question.choices?.A),
            B: normalizeLineValue(question.choices?.B),
            C: normalizeLineValue(question.choices?.C),
            D: normalizeLineValue(question.choices?.D),
          },
          answer,
          explanation: normalizeLineValue(question.explanation),
          hint: normalizeLineValue(question.hint),
        }];
      })
  );

  const part2 = Object.fromEntries(
    normalized.part2
      .sort((a, b) => a.questionNumber - b.questionNumber)
      .map((question, index) => {
        const qNum = question.questionNumber || index + 1;
        const answers: Record<string, boolean> = {};

        (['a', 'b', 'c', 'd'] as const).forEach((key) => {
          const answer = question.answers?.[key];
          if (typeof answer === 'boolean') {
            answers[key] = answer;
          } else {
            pushWarning(warnings, 'warning', `Phần II - Câu ${qNum} - ý ${key} chưa có đáp án rõ ràng sau khi AI chuẩn hóa.`, `P2-${qNum}-${key}`);
          }
        });

        return [qNum, {
          question: normalizeLineValue(question.question),
          statements: {
            a: normalizeLineValue(question.statements?.a),
            b: normalizeLineValue(question.statements?.b),
            c: normalizeLineValue(question.statements?.c),
            d: normalizeLineValue(question.statements?.d),
          },
          answers,
          explanation: normalizeLineValue(question.explanation),
          hint: normalizeLineValue(question.hint),
        }];
      })
  );

  const part3 = Object.fromEntries(
    normalized.part3
      .sort((a, b) => a.questionNumber - b.questionNumber)
      .map((question, index) => {
        const qNum = question.questionNumber || index + 1;
        const answer = normalizeLineValue(question.answer);

        if (!answer) {
          pushWarning(warnings, 'warning', `Phần III - Câu ${qNum} chưa có đáp án sau khi AI chuẩn hóa.`, `P3-${qNum}`);
        }

        return [qNum, {
          question: normalizeLineValue(question.question),
          answer,
          explanation: normalizeLineValue(question.explanation),
          hint: normalizeLineValue(question.hint),
        }];
      })
  );

  const parsedExam: ParsedWordExam = {
    title: normalizeLineValue(normalized.title),
    subject: normalizeLineValue(normalized.subject),
    grade: normalizeLineValue(normalized.grade),
    description: normalizeLineValue(normalized.description),
    instructions: normalizeLineValue(normalized.instructions),
    templateType: normalized.templateType || 'ONLINE_EXAM',
    durationMinutes: Math.max(1, Number(normalized.durationMinutes) || 50),
    totalScore: Math.max(1, Number(normalized.totalScore) || 10),
    maxAttempts: Math.max(1, Number(normalized.maxAttempts) || 1),
    part1,
    part2,
    part3,
    warnings,
  };

  if (!parsedExam.title.trim()) {
    pushWarning(warnings, 'error', 'AI chưa xác định rõ tiêu đề đề thi.');
  }

  if (!Object.keys(part1).length && !Object.keys(part2).length && !Object.keys(part3).length) {
    throw new Error('AI chưa tách được câu hỏi từ file Word này. Hãy thử file khác rõ cấu trúc hơn hoặc dùng mẫu chuẩn.');
  }

  return parsedExam;
}

function extractMessageContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((item: any) => {
        if (typeof item === 'string') return item;
        if (typeof item?.text === 'string') return item.text;
        return '';
      })
      .join('')
      .trim();
  }
  return '';
}

async function requestAiNormalization(
  rawText: string,
  htmlContent: string,
  semanticSnapshot: { containsImages: boolean; containsMath: boolean; formulaHints: string[]; documentXml: string },
  assets: EmbeddedAsset[]
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Chưa cấu hình OPENAI_API_KEY trên server nên chưa thể dùng AI import.');
  }

  const schema = {
    name: 'normalized_exam_import',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        title: { type: 'string' },
        subject: { type: 'string' },
        grade: { type: 'string' },
        description: { type: 'string' },
        instructions: { type: 'string' },
        templateType: { type: 'string', enum: ['ONLINE_EXAM', 'LEGACY_PHIU_TRA_LOI'] },
        durationMinutes: { type: 'number' },
        totalScore: { type: 'number' },
        maxAttempts: { type: 'number' },
        part1: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              questionNumber: { type: 'number' },
              question: { type: 'string' },
              choices: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  A: { type: 'string' },
                  B: { type: 'string' },
                  C: { type: 'string' },
                  D: { type: 'string' },
                },
                required: ['A', 'B', 'C', 'D'],
              },
              answer: { type: 'string' },
              explanation: { type: 'string' },
              hint: { type: 'string' },
            },
            required: ['questionNumber', 'question', 'choices', 'answer', 'explanation', 'hint'],
          },
        },
        part2: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              questionNumber: { type: 'number' },
              question: { type: 'string' },
              statements: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  a: { type: 'string' },
                  b: { type: 'string' },
                  c: { type: 'string' },
                  d: { type: 'string' },
                },
                required: ['a', 'b', 'c', 'd'],
              },
              answers: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  a: { type: ['boolean', 'null'] },
                  b: { type: ['boolean', 'null'] },
                  c: { type: ['boolean', 'null'] },
                  d: { type: ['boolean', 'null'] },
                },
                required: ['a', 'b', 'c', 'd'],
              },
              explanation: { type: 'string' },
              hint: { type: 'string' },
            },
            required: ['questionNumber', 'question', 'statements', 'answers', 'explanation', 'hint'],
          },
        },
        part3: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              questionNumber: { type: 'number' },
              question: { type: 'string' },
              answer: { type: 'string' },
              explanation: { type: 'string' },
              hint: { type: 'string' },
            },
            required: ['questionNumber', 'question', 'answer', 'explanation', 'hint'],
          },
        },
        reviewNotes: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['title', 'subject', 'grade', 'description', 'instructions', 'templateType', 'durationMinutes', 'totalScore', 'maxAttempts', 'part1', 'part2', 'part3', 'reviewNotes'],
    },
  };

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: [
            'Bạn là bộ máy chuẩn hóa đề thi Word cho hệ thống thi online.',
            'Nhiệm vụ: đọc nội dung trích ra từ file .docx rồi chuyển thành dữ liệu có cấu trúc.',
            'Không được bịa đáp án hoặc lời giải nếu tài liệu không nêu rõ.',
            'Nếu không chắc, hãy để chuỗi rỗng hoặc null và ghi rõ vào reviewNotes.',
            'Part 1 là trắc nghiệm 4 lựa chọn A/B/C/D.',
            'Part 2 là đúng/sai gồm các ý a/b/c/d.',
            'Part 3 là câu trả lời ngắn.',
            'Nếu đề không nói rõ phần, hãy tự suy luận cấu trúc hợp lý nhất nhưng vẫn ưu tiên không bịa thêm dữ kiện.',
            'Nếu trong HTML có token dạng [WORD_IMAGE_1], [WORD_IMAGE_2]..., phải giữ nguyên chính xác token đó trong đúng trường question/choice/statement liên quan.',
            'Không được xóa, đổi tên, viết lại hoặc gộp các token [WORD_IMAGE_x]. Đây là placeholder để hệ thống gắn lại ảnh/công thức gốc từ file Word.',
            'Có thể trả về chuỗi HTML hợp lệ trong các trường nội dung, nhưng vẫn phải giữ nguyên token ảnh/công thức nếu token xuất hiện trong tài liệu.',
            'Nếu tài liệu có công thức toán học dạng Office Math, hãy ưu tiên phục hồi công thức từ formulaHints và documentXml.',
            'Khi phục hồi công thức, hãy chèn lại ở dạng dễ đọc nhất cho web, ưu tiên giữ nguyên biểu thức toán học đầy đủ thay vì lược bỏ.',
            'Nếu phương án nào được tô vàng, gạch chân, in đậm, đổi màu nổi bật, hoặc nhấn mạnh rõ rệt trong HTML/Word thì xem đó là tín hiệu rất mạnh cho đáp án đúng.',
            'Khi có tín hiệu định dạng nổi bật và không mâu thuẫn với nội dung kiến thức, hãy ưu tiên điền đáp án đúng theo tín hiệu đó.',
            'Nếu nội dung là công thức toán học, ưu tiên trả về ở dạng LaTeX đặt trong \\(...\\) hoặc \\[...\\] để web render đẹp.',
          ].join('\n'),
        },
        {
          role: 'user',
          content: [
            'Hãy phân tích nội dung Word sau và trả về JSON đúng schema.',
            'Nội dung text trích thô từ file Word:',
            rawText,
            'Nội dung HTML đã nhúng ảnh base64 từ file Word:',
            htmlContent,
            'Danh sách token ảnh/công thức cần bảo toàn nguyên vẹn:',
            assets.map((asset) => asset.token).join(', ') || '(không có)',
            `File có ảnh: ${semanticSnapshot.containsImages ? 'CO' : 'KHONG'}`,
            `File có công thức toán học Office Math: ${semanticSnapshot.containsMath ? 'CO' : 'KHONG'}`,
            'Danh sách gợi ý công thức tách từ XML Word:',
            semanticSnapshot.formulaHints.join('\n') || '(không có)',
            'XML gốc của word/document.xml để tham chiếu khi cần khôi phục công thức:',
            semanticSnapshot.documentXml,
          ].join('\n\n'),
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: schema,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API lỗi ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const content = extractMessageContent(data?.choices?.[0]?.message?.content);
  if (!content) {
    throw new Error('OpenAI API không trả về nội dung chuẩn hóa.');
  }

  return JSON.parse(content) as AiNormalizedExam;
}

async function requestPart1Repair(
  questionNumber: number,
  currentQuestion: AiPart1Question,
  rawTextSnippet: string,
  htmlSnippet: string,
  semanticSnapshot: { containsImages: boolean; containsMath: boolean; formulaHints: string[]; documentXml: string }
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Chưa cấu hình OPENAI_API_KEY trên server nên chưa thể dùng AI import.');
  }

  const schema = {
    name: 'repair_part1_import_question',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        question: { type: 'string' },
        choices: {
          type: 'object',
          additionalProperties: false,
          properties: {
            A: { type: 'string' },
            B: { type: 'string' },
            C: { type: 'string' },
            D: { type: 'string' },
          },
          required: ['A', 'B', 'C', 'D'],
        },
        answer: { type: 'string', enum: ['A', 'B', 'C', 'D', ''] },
        explanation: { type: 'string' },
        hint: { type: 'string' },
        confidenceNote: { type: 'string' },
      },
      required: ['question', 'choices', 'answer', 'explanation', 'hint', 'confidenceNote'],
    },
  };

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: [
            'Bạn là bộ máy phục hồi câu trắc nghiệm bị thiếu dữ liệu khi import Word.',
            'Nhiệm vụ: khôi phục đầy đủ nội dung câu hỏi, 4 đáp án A/B/C/D, đáp án đúng, lời giải chi tiết và gợi ý.',
            'Ưu tiên dùng đúng dữ liệu có trong đoạn HTML/Word được cung cấp.',
            'Nếu có token [WORD_IMAGE_x], phải giữ nguyên token đó trong đúng đáp án hoặc nội dung liên quan để hệ thống gắn lại công thức/ảnh gốc.',
            'Nếu công thức toán học có thể viết lại rõ hơn bằng LaTeX thì được phép dùng LaTeX, nhưng không được làm mất token [WORD_IMAGE_x] nếu token là dữ kiện gốc.',
            'Nếu đã đủ dữ kiện để giải thì phải viết lời giải chi tiết, rõ từng bước, phù hợp học sinh THPT.',
            'Nếu không khôi phục chắc chắn được toàn bộ đáp án, vẫn phải cố gắng giữ lại những phần chắc chắn và nêu rõ trong confidenceNote.',
          ].join('\n'),
        },
        {
          role: 'user',
          content: [
            `Cần phục hồi câu trắc nghiệm số ${questionNumber}.`,
            'Dữ liệu hiện tại đã tách được:',
            JSON.stringify(currentQuestion),
            'Đoạn text thô quanh câu này:',
            rawTextSnippet,
            'Đoạn HTML quanh câu này:',
            htmlSnippet,
            `File có công thức toán học Office Math: ${semanticSnapshot.containsMath ? 'CO' : 'KHONG'}`,
            'Formula hints:',
            semanticSnapshot.formulaHints.join('\n') || '(không có)',
          ].join('\n\n'),
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: schema,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API lỗi ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const content = extractMessageContent(data?.choices?.[0]?.message?.content);
  if (!content) {
    throw new Error('AI không trả về dữ liệu phục hồi câu trắc nghiệm.');
  }

  return JSON.parse(content) as AiRepairPart1Question;
}

async function enrichNormalizedExamWithAi(
  normalized: AiNormalizedExam,
  rawText: string,
  htmlContent: string,
  semanticSnapshot: { containsImages: boolean; containsMath: boolean; formulaHints: string[]; documentXml: string }
) {
  const nextNormalized: AiNormalizedExam = {
    ...normalized,
    part1: [...normalized.part1],
    part2: [...normalized.part2],
    part3: [...normalized.part3],
    reviewNotes: [...normalized.reviewNotes],
  };

  for (let index = 0; index < nextNormalized.part1.length; index += 1) {
    const question = nextNormalized.part1[index];
    const qNum = question.questionNumber || index + 1;

    if (hasMissingPart1Content(question)) {
      try {
        const repaired = await requestPart1Repair(
          qNum,
          question,
          extractQuestionSnippet(rawText, qNum),
          extractQuestionSnippet(htmlContent, qNum),
          semanticSnapshot
        );

        nextNormalized.part1[index] = {
          ...question,
          question: normalizeLineValue(question.question) || repaired.question,
          choices: {
            A: normalizeLineValue(question.choices?.A) || repaired.choices.A,
            B: normalizeLineValue(question.choices?.B) || repaired.choices.B,
            C: normalizeLineValue(question.choices?.C) || repaired.choices.C,
            D: normalizeLineValue(question.choices?.D) || repaired.choices.D,
          },
          answer: normalizeLineValue(question.answer) || repaired.answer,
          explanation: normalizeLineValue(question.explanation) || repaired.explanation,
          hint: normalizeLineValue(question.hint) || repaired.hint,
        };

        if (repaired.confidenceNote.trim()) {
          nextNormalized.reviewNotes.push(`Repair note P1 câu ${qNum}: ${repaired.confidenceNote.trim()}`);
        }
      } catch (error) {
        nextNormalized.reviewNotes.push(
          `Repair note P1 câu ${qNum}: ${error instanceof Error ? error.message : 'Không thể phục hồi đầy đủ đáp án/công thức.'}`
        );
      }
    }

    if (!normalizeLineValue(nextNormalized.part1[index].explanation) || !normalizeLineValue(nextNormalized.part1[index].answer)) {
      try {
        const solved = await solveQuestionWithAI({
          subject: nextNormalized.subject,
          grade: nextNormalized.grade,
          title: nextNormalized.title,
          questionKind: 'PART1',
          questionNumber: qNum,
          questionHtml: nextNormalized.part1[index].question,
          choices: nextNormalized.part1[index].choices,
          currentAnswer: nextNormalized.part1[index].answer,
          currentExplanation: nextNormalized.part1[index].explanation,
          currentHint: nextNormalized.part1[index].hint,
        });

        if ('answer' in solved) {
          nextNormalized.part1[index] = {
            ...nextNormalized.part1[index],
            answer: normalizeLineValue(nextNormalized.part1[index].answer) || solved.answer,
            explanation: normalizeLineValue(nextNormalized.part1[index].explanation) || solved.explanation,
            hint: normalizeLineValue(nextNormalized.part1[index].hint) || solved.hint,
          };

          if (solved.confidenceNote?.trim()) {
            nextNormalized.reviewNotes.push(`AI solve P1 câu ${qNum}: ${solved.confidenceNote.trim()}`);
          }
        }
      } catch (error) {
        nextNormalized.reviewNotes.push(
          `AI solve P1 câu ${qNum}: ${error instanceof Error ? error.message : 'Không thể tự giải câu hỏi này.'}`
        );
      }
    }
  }

  for (let index = 0; index < nextNormalized.part2.length; index += 1) {
    const question = nextNormalized.part2[index];
    const qNum = question.questionNumber || index + 1;
    const answers = question.answers || {};
    const missingAnswers = ['a', 'b', 'c', 'd'].some((key) => typeof answers[key] !== 'boolean');
    const missingExplanation = !normalizeLineValue(question.explanation);

    if (!missingAnswers && !missingExplanation) continue;

    try {
      const solved = await solveQuestionWithAI({
        subject: nextNormalized.subject,
        grade: nextNormalized.grade,
        title: nextNormalized.title,
        questionKind: 'PART2',
        questionNumber: qNum,
        questionHtml: question.question,
        statements: question.statements,
        currentExplanation: question.explanation,
        currentHint: question.hint,
      });

      if ('answers' in solved) {
        nextNormalized.part2[index] = {
          ...question,
          answers: {
            a: typeof question.answers?.a === 'boolean' ? question.answers.a : Boolean(solved.answers.a),
            b: typeof question.answers?.b === 'boolean' ? question.answers.b : Boolean(solved.answers.b),
            c: typeof question.answers?.c === 'boolean' ? question.answers.c : Boolean(solved.answers.c),
            d: typeof question.answers?.d === 'boolean' ? question.answers.d : Boolean(solved.answers.d),
          },
          explanation: normalizeLineValue(question.explanation)
            || Object.entries(solved.explanations || {})
              .map(([key, value]) => `${key}) ${value}`)
              .join('\n'),
          hint: normalizeLineValue(question.hint) || solved.hint,
        };

        if (solved.confidenceNote?.trim()) {
          nextNormalized.reviewNotes.push(`AI solve P2 câu ${qNum}: ${solved.confidenceNote.trim()}`);
        }
      }
    } catch (error) {
      nextNormalized.reviewNotes.push(
        `AI solve P2 câu ${qNum}: ${error instanceof Error ? error.message : 'Không thể tự giải câu hỏi này.'}`
      );
    }
  }

  for (let index = 0; index < nextNormalized.part3.length; index += 1) {
    const question = nextNormalized.part3[index];
    const qNum = question.questionNumber || index + 1;

    if (normalizeLineValue(question.answer) && normalizeLineValue(question.explanation)) continue;

    try {
      const solved = await solveQuestionWithAI({
        subject: nextNormalized.subject,
        grade: nextNormalized.grade,
        title: nextNormalized.title,
        questionKind: 'PART3',
        questionNumber: qNum,
        questionHtml: question.question,
        currentAnswer: question.answer,
        currentExplanation: question.explanation,
        currentHint: question.hint,
      });

      if ('answer' in solved) {
        nextNormalized.part3[index] = {
          ...question,
          answer: normalizeLineValue(question.answer) || solved.answer,
          explanation: normalizeLineValue(question.explanation) || solved.explanation,
          hint: normalizeLineValue(question.hint) || solved.hint,
        };

        if (solved.confidenceNote?.trim()) {
          nextNormalized.reviewNotes.push(`AI solve P3 câu ${qNum}: ${solved.confidenceNote.trim()}`);
        }
      }
    } catch (error) {
      nextNormalized.reviewNotes.push(
        `AI solve P3 câu ${qNum}: ${error instanceof Error ? error.message : 'Không thể tự giải câu hỏi này.'}`
      );
    }
  }

  return nextNormalized;
}

export async function normalizeWordImport(input: NormalizeWordImportInput): Promise<NormalizeWordImportResult> {
  requireDocx(input.fileName);

  const buffer = Buffer.from(input.base64, 'base64');
  const embeddedAssets: EmbeddedAsset[] = [];
  const semanticSnapshot = await inspectDocxSemantics(buffer);
  const { value } = await mammoth.extractRawText({ buffer });
  const { value: htmlValue } = await mammoth.convertToHtml(
    { buffer },
    { convertImage: mammoth.images.imgElement(createEmbeddedAssetConverter(embeddedAssets)) }
  );
  const extractedText = value.trim();
  const htmlContent = injectAssetTokensIntoHtml(htmlValue.trim(), embeddedAssets);

  if (!extractedText) {
    throw new Error('Không đọc được nội dung chữ từ file Word này.');
  }

  const normalized = restoreEmbeddedAssetsInNormalizedExam(
    await enrichNormalizedExamWithAi(
      await requestAiNormalization(extractedText, htmlContent, semanticSnapshot, embeddedAssets),
      extractedText,
      htmlContent,
      semanticSnapshot
    ),
    embeddedAssets
  );
  const normalizedTemplateText = buildTemplateText(normalized);
  const parsedExam = toParsedExam(normalized);

  normalized.reviewNotes
    .filter((note) => note.trim())
    .forEach((note, index) => {
      pushWarning(parsedExam.warnings, 'info', `AI note ${index + 1}: ${note.trim()}`);
    });

  pushWarning(parsedExam.warnings, 'info', 'Đề này được AI chuẩn hóa từ file Word không theo mẫu chuẩn. Hãy rà soát nhanh nội dung trước khi lưu.');
  if (semanticSnapshot.containsMath) {
    pushWarning(parsedExam.warnings, 'info', 'Hệ thống đã phát hiện công thức toán học trong file Word và ưu tiên phục hồi công thức bằng AI.');
  }
  if (semanticSnapshot.containsImages) {
    pushWarning(parsedExam.warnings, 'info', 'Hệ thống đã phát hiện ảnh trong file Word và ưu tiên giữ ảnh trong nội dung đề.');
  }

  return {
    parsedExam,
    normalizedTemplateText,
    extractedTextPreview: extractedText.slice(0, 3000),
    usedAi: true,
    model: OPENAI_MODEL,
  };
}
