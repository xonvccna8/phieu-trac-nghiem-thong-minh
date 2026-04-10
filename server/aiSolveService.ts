import {
  buildSolveQuestionSystemPrompt,
  buildSolveQuestionUserPrompt,
  getSolveQuestionJsonSchema,
  type SolvePart1Result,
  type SolvePart2Result,
  type SolvePart3Result,
  type SolveQuestionContext,
} from './aiSolvePrompts.js';

export type SolveQuestionResponse = SolvePart1Result | SolvePart2Result | SolvePart3Result;

const OPENAI_MODEL = 'gpt-5.4-mini';

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

export async function solveQuestionWithAI(context: SolveQuestionContext): Promise<SolveQuestionResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Chưa cấu hình OPENAI_API_KEY trên server nên chưa thể dùng AI giải bài.');
  }

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
          content: buildSolveQuestionSystemPrompt(),
        },
        {
          role: 'user',
          content: buildSolveQuestionUserPrompt(context),
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: getSolveQuestionJsonSchema(context.questionKind),
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
    throw new Error('AI không trả về dữ liệu giải bài.');
  }

  return JSON.parse(content) as SolveQuestionResponse;
}
