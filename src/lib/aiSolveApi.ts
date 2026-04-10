import type { SolveQuestionContext, SolvePart1Result, SolvePart2Result, SolvePart3Result } from '../../server/aiSolvePrompts';

type SolveQuestionResult = SolvePart1Result | SolvePart2Result | SolvePart3Result;

function getApiBaseUrl() {
  const explicitBaseUrl = (import.meta as any).env?.VITE_AI_IMPORT_API_BASE_URL?.trim();
  if (explicitBaseUrl) return explicitBaseUrl.replace(/\/$/, '');

  if (typeof window !== 'undefined' && /^https?:$/i.test(window.location.protocol)) {
    return window.location.origin;
  }

  return 'https://phieutraloitracnghiem.vercel.app';
}

function toFriendlySolveError(rawMessage: string) {
  const message = rawMessage.trim();
  if (!message) return 'Không thể dùng AI để giải câu hỏi này.';

  if (message.includes('OPENAI_API_KEY')) {
    return 'Server chưa cấu hình OPENAI_API_KEY nên chưa thể dùng AI giải bài.';
  }

  if (message.includes('401') || message.includes('403')) {
    return 'OpenAI API key trên server không hợp lệ hoặc chưa đủ quyền để dùng AI giải bài.';
  }

  if (message.includes('429')) {
    return 'AI giải bài đang quá tải hoặc đã chạm giới hạn sử dụng. Vui lòng thử lại sau.';
  }

  return `AI giải bài đang lỗi phía server: ${message}`;
}

export async function solveQuestionWithAI(context: SolveQuestionContext): Promise<SolveQuestionResult> {
  const response = await fetch(`${getApiBaseUrl()}/api/solve-question`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(context),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(toFriendlySolveError(payload?.error || 'Không thể dùng AI để giải câu hỏi này.'));
  }

  return payload as SolveQuestionResult;
}
