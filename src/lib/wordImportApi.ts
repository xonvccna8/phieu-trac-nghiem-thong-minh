import type { ParsedWordExam } from './wordImportShared';

interface NormalizeWordApiResponse {
  parsedExam: ParsedWordExam;
  normalizedTemplateText: string;
  extractedTextPreview: string;
  usedAi: boolean;
  model: string;
}

function toFriendlyImportError(rawMessage: string) {
  const message = rawMessage.trim();

  if (!message) {
    return 'Không thể chuẩn hóa file Word bằng AI. Vui lòng thử lại.';
  }

  if (message.includes('OPENAI_API_KEY')) {
    return 'Server chưa cấu hình OPENAI_API_KEY nên chưa thể dùng AI import. Hãy thêm biến môi trường trên Vercel rồi deploy lại.';
  }

  if (message.includes('429')) {
    return 'AI import đang quá tải hoặc đã chạm giới hạn sử dụng. Vui lòng thử lại sau ít phút.';
  }

  if (message.includes('401') || message.includes('403')) {
    return 'OpenAI API key trên server không hợp lệ hoặc không đủ quyền. Hãy kiểm tra lại OPENAI_API_KEY trên Vercel.';
  }

  if (message.includes('supports') || message.includes('.docx')) {
    return message;
  }

  return `AI import đang lỗi phía server: ${message}`;
}

function getApiBaseUrl() {
  const explicitBaseUrl = (import.meta as any).env?.VITE_AI_IMPORT_API_BASE_URL?.trim();
  if (explicitBaseUrl) return explicitBaseUrl.replace(/\/$/, '');

  if (typeof window !== 'undefined' && /^https?:$/i.test(window.location.protocol)) {
    return window.location.origin;
  }

  return 'https://phieutraloitracnghiem.vercel.app';
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

export async function normalizeWordFileWithAI(file: File): Promise<NormalizeWordApiResponse> {
  const arrayBuffer = await file.arrayBuffer();
  const response = await fetch(`${getApiBaseUrl()}/api/normalize-word`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type,
      base64: arrayBufferToBase64(arrayBuffer),
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(toFriendlyImportError(payload?.error || 'Không thể chuẩn hóa file Word bằng AI.'));
  }

  return payload as NormalizeWordApiResponse;
}
