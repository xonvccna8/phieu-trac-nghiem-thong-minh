import mammoth from 'mammoth';
import { ExamVersion } from '@/types';

export async function parseMixingAnswerKeyWordFile(file: File, existingVersions: ExamVersion[]): Promise<ExamVersion[]> {
  if (!file.name.toLowerCase().endsWith('.docx')) {
    throw new Error('Vui lòng tải lên file .docx!');
  }

  const arrayBuffer = await file.arrayBuffer();
  // We use Mammoth to convert it to HTML. Word Tables become <table>, <tr>, <td>
  const { value: htmlText } = await mammoth.convertToHtml({ arrayBuffer });
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, 'text/html');
  const body = doc.body;

  // Create a deeply cloned map of versions to edit
  const updatedVersionsMap = new Map<string, ExamVersion>();
  existingVersions.forEach(v => {
      updatedVersionsMap.set(v.code, JSON.parse(JSON.stringify(v)));
  });
  
  let currentPart: 1 | 2 | 3 | null = null;
  
  for (const node of Array.from(body.children)) {
    const text = node.textContent?.trim().toUpperCase() || '';

    // Detect Parts
    if (text.includes('[DAP_AN_PHAN_1]')) { currentPart = 1; continue; }
    if (text.includes('[DAP_AN_PHAN_2]')) { currentPart = 2; continue; }
    if (text.includes('[DAP_AN_PHAN_3]')) { currentPart = 3; continue; }

    // Detect Tables
    if (node.tagName.toLowerCase() === 'table' && currentPart !== null) {
      const rows = Array.from(node.querySelectorAll('tr'));
      if (rows.length < 2) continue; // Need at least header + 1 row

      // Parse Header
      const headerCols = Array.from(rows[0].querySelectorAll('td')).map(td => td.textContent?.trim() || '');
      // Format: ['Câu', 'Lời Giải', '1101', '1102', ...]
      // We start reading codes from index 2
      const codesMapping: string[] = [];
      for (let i = 2; i < headerCols.length; i++) {
          codesMapping.push(headerCols[i]);
      }

      if (currentPart === 1) {
        for (let i = 1; i < rows.length; i++) {
          const cols = rows[i].querySelectorAll('td');
          if (cols.length >= 2 + codesMapping.length) {
            const qNum = parseInt(cols[0].textContent || '0', 10);
            if (isNaN(qNum) || qNum < 1 || qNum > 18) continue;
            
            const explanation = cols[1].textContent?.trim();

            codesMapping.forEach((code, index) => {
                const targetVersion = updatedVersionsMap.get(code);
                if (!targetVersion) return; // Skip if code not found in current exams

                const answerText = cols[2 + index].textContent?.trim().toUpperCase();
                let answer = '';
                if (answerText === 'A' || answerText === 'B' || answerText === 'C' || answerText === 'D') {
                    answer = answerText;
                } else if (answerText === 'X' || answerText === 'V') {
                    // Fallback for previous instruction, but grid usually expects precise A,B,C,D
                    answer = 'X'; // Might not be valid for A, B, C, D dropdown, but let's just save what they typed.
                }

                if (!targetVersion.derivedExam.part1) targetVersion.derivedExam.part1 = {};
                const existing = (targetVersion.derivedExam.part1 as any)[qNum] || {};
                
                (targetVersion.derivedExam.part1 as any)[qNum] = { 
                    ...existing, 
                    answer: answer || existing.answer, 
                    explanation: explanation || existing.explanation 
                };
            });
          }
        }
      } else if (currentPart === 2) {
         for (let i = 1; i < rows.length; i++) {
            const cols = rows[i].querySelectorAll('td');
            if (cols.length >= 2 + codesMapping.length) {
              const labelContent = cols[0].textContent?.trim().toLowerCase() || '';
              // labelContent format could be "1a", "2b"
              const qNumMatch = labelContent.match(/^(\d+)([abcd])$/);
              if (!qNumMatch) continue;

              const qNum = parseInt(qNumMatch[1], 10);
              const subLabel = qNumMatch[2];
              if (isNaN(qNum) || qNum < 1 || qNum > 4) continue;
              
              const explanation = cols[1].textContent?.trim();

              codesMapping.forEach((code, index) => {
                const targetVersion = updatedVersionsMap.get(code);
                if (!targetVersion) return;

                const mark = cols[2 + index].textContent?.trim().toLowerCase();
                let isTrue: boolean | undefined = undefined;
                if (mark === 'đ' || mark === 'd') isTrue = true;
                if (mark === 's') isTrue = false;

                if (!targetVersion.derivedExam.part2) targetVersion.derivedExam.part2 = {};
                const existingQ = (targetVersion.derivedExam.part2 as any)[qNum] || { answers: {}, explanations: {} };
                
                if (isTrue !== undefined) {
                    existingQ.answers = existingQ.answers || {};
                    existingQ.answers[subLabel] = isTrue;
                }
                if (explanation) {
                    existingQ.explanations = existingQ.explanations || {};
                    existingQ.explanations[subLabel] = { explanation };
                }
                (targetVersion.derivedExam.part2 as any)[qNum] = existingQ;
              });
            }
          }
      } else if (currentPart === 3) {
         for (let i = 1; i < rows.length; i++) {
            const cols = rows[i].querySelectorAll('td');
            if (cols.length >= 2 + codesMapping.length) {
              const qNum = parseInt(cols[0].textContent || '0', 10);
              if (isNaN(qNum) || qNum < 1 || qNum > 6) continue;
              
              const explanation = cols[1].textContent?.trim();

              codesMapping.forEach((code, index) => {
                const targetVersion = updatedVersionsMap.get(code);
                if (!targetVersion) return;

                const answer = cols[2 + index].textContent?.trim();

                if (!targetVersion.derivedExam.part3) targetVersion.derivedExam.part3 = {};
                const existing = (targetVersion.derivedExam.part3 as any)[qNum] || {};
                (targetVersion.derivedExam.part3 as any)[qNum] = { 
                    ...existing, 
                    answer: answer || existing.answer, 
                    explanation: explanation || existing.explanation 
                };
              });
            }
          }
      }
      currentPart = null; // Reset part after parsing table
    }
  }

  return Array.from(updatedVersionsMap.values());
}
