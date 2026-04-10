import { solveQuestionWithAI } from '../server/aiSolveService.js';

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
    const result = await solveQuestionWithAI(req.body || {});
    return res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể dùng AI để giải câu hỏi này.';
    return res.status(500).json({ error: message });
  }
}
