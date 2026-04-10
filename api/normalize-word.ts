import { normalizeWordImport } from '../server/wordImportAi.js';

function setCorsHeaders(res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req: any, res: any) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fileName, base64 } = req.body || {};

    if (!fileName || !base64) {
      return res.status(400).json({ error: 'Thiếu fileName hoặc base64.' });
    }

    const result = await normalizeWordImport({ fileName, base64 });
    return res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể chuẩn hóa file Word bằng AI.';
    return res.status(500).json({ error: message });
  }
}
