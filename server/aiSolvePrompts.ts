type QuestionKind = 'PART1' | 'PART2' | 'PART3';

export interface SolveQuestionContext {
  subject?: string;
  grade?: string;
  title?: string;
  questionKind: QuestionKind;
  questionNumber: number;
  questionHtml: string;
  choices?: Record<string, string>;
  statements?: Record<string, string>;
  currentAnswer?: string;
  currentExplanation?: string;
  currentHint?: string;
}

export interface SolvePart1Result {
  answer: 'A' | 'B' | 'C' | 'D' | '';
  explanation: string;
  hint: string;
  similarExercise: {
    question: string;
    answer: 'A' | 'B' | 'C' | 'D' | '';
  };
  confidenceNote: string;
}

export interface SolvePart2Result {
  answers: {
    a: boolean | null;
    b: boolean | null;
    c: boolean | null;
    d: boolean | null;
  };
  explanations: {
    a: string;
    b: string;
    c: string;
    d: string;
  };
  hint: string;
  similarExercise: {
    question: string;
    answer: string;
  };
  confidenceNote: string;
}

export interface SolvePart3Result {
  answer: string;
  explanation: string;
  hint: string;
  similarExercise: {
    question: string;
    answer: string;
  };
  confidenceNote: string;
}

export function buildSolveQuestionSystemPrompt() {
  return [
    'Bạn là trợ lý giải bài tập cho hệ thống thi online giáo dục.',
    'Nhiệm vụ: giải chính xác, điền đáp án còn thiếu, viết lời giải ngắn gọn nhưng đủ hiểu, tạo một gợi ý học sinh dễ hiểu và sinh 1 bài tương tự.',
    'Ưu tiên kiến thức đúng, lập luận rõ, không dài dòng.',
    'Nếu dữ kiện thiếu hoặc ảnh/công thức không đủ rõ, không được đoán bừa. Hãy để đáp án rỗng hoặc null và nói rõ lý do trong confidenceNote.',
    'Có thể nhận nội dung dạng HTML. Giữ nguyên các thẻ ảnh hoặc công thức nếu cần khi tạo bài tương tự.',
    'Nếu đề bài là toán học, hóa học hoặc vật lý có công thức, hãy trình bày công thức rõ ràng, ưu tiên LaTeX trong \\(...\\) hoặc \\[...\\] để web render đẹp.',
    'Khi đã đủ dữ kiện để giải, phải điền lời giải chi tiết theo từng bước suy luận; không được chỉ trả lời đáp án ngắn.',
    'Với câu trắc nghiệm, cần nêu ngắn gọn vì sao đáp án đúng đúng và vì sao các phương án còn lại sai hoặc không phù hợp nếu điều đó giúp học sinh hiểu bài.',
    'Bài tương tự phải cùng dạng kiến thức, độ khó tương đương, nhưng số liệu hoặc ngữ cảnh khác hợp lý.',
    'Lời giải hướng tới học sinh THPT, dùng tiếng Việt tự nhiên, khoa học, dễ học.',
  ].join('\n');
}

export function buildSolveQuestionUserPrompt(context: SolveQuestionContext) {
  const baseInfo = [
    `Môn học: ${context.subject || ''}`,
    `Khối lớp: ${context.grade || ''}`,
    `Tên đề: ${context.title || ''}`,
    `Loại câu: ${context.questionKind}`,
    `Số câu: ${context.questionNumber}`,
    `Nội dung câu hỏi (HTML): ${context.questionHtml || ''}`,
  ];

  if (context.questionKind === 'PART1') {
    return [
      ...baseInfo,
      `Lựa chọn A: ${context.choices?.A || ''}`,
      `Lựa chọn B: ${context.choices?.B || ''}`,
      `Lựa chọn C: ${context.choices?.C || ''}`,
      `Lựa chọn D: ${context.choices?.D || ''}`,
      `Đáp án hiện có: ${context.currentAnswer || ''}`,
      `Lời giải hiện có: ${context.currentExplanation || ''}`,
      'Yêu cầu:',
      '1. Xác định đáp án đúng A/B/C/D nếu đủ dữ kiện.',
      '2. Viết lời giải chi tiết dễ hiểu cho học sinh, có nêu bước suy luận hoặc công thức cần dùng.',
      '3. Viết một gợi ý ngắn để học sinh định hướng làm bài.',
      '4. Tạo 1 bài tương tự cùng dạng và đáp án của bài tương tự.',
      '5. Trả về JSON đúng schema, ngắn gọn nhưng đầy đủ.',
    ].join('\n');
  }

  if (context.questionKind === 'PART2') {
    return [
      ...baseInfo,
      `Ý a: ${context.statements?.a || ''}`,
      `Ý b: ${context.statements?.b || ''}`,
      `Ý c: ${context.statements?.c || ''}`,
      `Ý d: ${context.statements?.d || ''}`,
      `Lời giải hiện có: ${context.currentExplanation || ''}`,
      'Yêu cầu:',
      '1. Xác định từng ý a/b/c/d là đúng hay sai nếu đủ dữ kiện.',
      '2. Viết lời giải rõ ràng cho từng ý, chỉ ra cơ sở kiến thức hoặc phép suy luận tương ứng.',
      '3. Viết một gợi ý học sinh cần chú ý khi làm dạng đúng/sai này.',
      '4. Tạo 1 bài tương tự cùng dạng và nêu đáp án ngắn gọn cho bài tương tự.',
      '5. Trả về JSON đúng schema.',
    ].join('\n');
  }

  return [
    ...baseInfo,
    `Đáp án hiện có: ${context.currentAnswer || ''}`,
    `Lời giải hiện có: ${context.currentExplanation || ''}`,
    'Yêu cầu:',
    '1. Tính hoặc suy ra đáp án cuối cùng nếu đủ dữ kiện.',
    '2. Viết lời giải chi tiết theo từng bước, trình bày phép biến đổi và công thức rõ ràng.',
    '3. Viết 1 gợi ý ngắn giúp học sinh tự làm.',
    '4. Tạo 1 bài tương tự cùng dạng và đáp án.',
    '5. Trả về JSON đúng schema.',
  ].join('\n');
}

export function getSolveQuestionJsonSchema(questionKind: QuestionKind) {
  if (questionKind === 'PART1') {
    return {
      name: 'solve_part1_question',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          answer: { type: 'string', enum: ['A', 'B', 'C', 'D', ''] },
          explanation: { type: 'string' },
          hint: { type: 'string' },
          similarExercise: {
            type: 'object',
            additionalProperties: false,
            properties: {
              question: { type: 'string' },
              answer: { type: 'string', enum: ['A', 'B', 'C', 'D', ''] },
            },
            required: ['question', 'answer'],
          },
          confidenceNote: { type: 'string' },
        },
        required: ['answer', 'explanation', 'hint', 'similarExercise', 'confidenceNote'],
      },
    };
  }

  if (questionKind === 'PART2') {
    return {
      name: 'solve_part2_question',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
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
          explanations: {
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
          hint: { type: 'string' },
          similarExercise: {
            type: 'object',
            additionalProperties: false,
            properties: {
              question: { type: 'string' },
              answer: { type: 'string' },
            },
            required: ['question', 'answer'],
          },
          confidenceNote: { type: 'string' },
        },
        required: ['answers', 'explanations', 'hint', 'similarExercise', 'confidenceNote'],
      },
    };
  }

  return {
    name: 'solve_part3_question',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        answer: { type: 'string' },
        explanation: { type: 'string' },
        hint: { type: 'string' },
        similarExercise: {
          type: 'object',
          additionalProperties: false,
          properties: {
            question: { type: 'string' },
            answer: { type: 'string' },
          },
          required: ['question', 'answer'],
        },
        confidenceNote: { type: 'string' },
      },
      required: ['answer', 'explanation', 'hint', 'similarExercise', 'confidenceNote'],
    },
  };
}
