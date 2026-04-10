import JSZip from 'jszip';
import { Assignment, Attempt, Exam, ExamVersion, Student } from '@/types';

const WORD_HTML_PREFIX = `
<html xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:w="urn:schemas-microsoft-com:office:word"
xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8" />
  <meta name="ProgId" content="Word.Document" />
  <meta name="Generator" content="PHIEU HOC TAP THONG MINH" />
  <meta name="Originator" content="PHIEU HOC TAP THONG MINH" />
  <title>PHIEU HOC TAP THONG MINH</title>
  <style>
    @page { size: A4; margin: 1cm 1cm 1cm 1cm; }
    body { font-family: "Times New Roman", Times, serif; color: #0f172a; font-size: 12pt; line-height: 1.45; }
    h1, h2, h3, h4 { margin: 0; }
    p { margin: 0 0 8px; }
    .doc-shell { max-width: 100%; }
    .doc-header { border: 2px solid #0f766e; border-radius: 16px; padding: 18px 20px; background: #f0fdfa; margin-bottom: 18px; }
    .doc-kicker { font-size: 9pt; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; color: #0f766e; margin-bottom: 8px; }
    .doc-title { font-size: 18pt; font-weight: 700; color: #0f172a; text-align: center; text-transform: uppercase; }
    .doc-subtitle { color: #475569; margin-top: 6px; }
    .meta-grid { width: 100%; border-collapse: separate; border-spacing: 10px; margin: 10px -10px 6px; }
    .meta-card { width: 50%; border: 1px solid #cbd5e1; border-radius: 12px; padding: 10px 12px; background: #fff; vertical-align: top; }
    .meta-label { font-size: 8.5pt; color: #64748b; text-transform: uppercase; font-weight: bold; margin-bottom: 4px; }
    .meta-value { font-size: 12pt; color: #0f172a; font-weight: 600; }
    .section-card { border: 1px solid #cbd5e1; border-radius: 14px; padding: 14px 16px; margin-bottom: 16px; background: #fff; }
    .section-title { font-size: 14pt; font-weight: 700; color: #0f172a; margin-bottom: 8px; text-transform: uppercase; }
    .section-note { color: #475569; margin-bottom: 10px; }
    .question-block { border-top: 1px solid #e2e8f0; padding-top: 12px; margin-top: 12px; }
    .question-block:first-child { border-top: none; padding-top: 0; margin-top: 0; }
    .question-title { font-size: 12pt; font-weight: 700; color: #111827; margin-bottom: 8px; }
    .question-content { margin-bottom: 8px; font-size: 12pt; }
    .choice-grid { width: 100%; border-collapse: separate; border-spacing: 8px 8px; table-layout: fixed; }
    .choice-grid td { width: 25%; vertical-align: top; }
    .choice-row, .statement-row { margin: 6px 0; padding: 8px 10px; border: 1px solid #e2e8f0; border-radius: 10px; background: #f8fafc; font-size: 12pt; }
    .choice-label, .statement-label { display: inline-block; min-width: 28px; font-weight: 700; color: #0f766e; }
    .answer-sheet { width: 100%; border-collapse: collapse; margin-top: 10px; }
    .answer-sheet th, .answer-sheet td { border: 1px solid #cbd5e1; text-align: center; padding: 7px 6px; font-size: 12pt; }
    .answer-sheet th { background: #f8fafc; color: #334155; font-weight: 700; }
    .answer-sheet .question-col { width: 50px; background: #f8fafc; font-weight: 700; }
    .cell-correct { background: #dcfce7; color: #166534; font-weight: 700; }
    .cell-wrong { background: #fee2e2; color: #b91c1c; font-weight: 700; }
    .cell-selected { background: #dbeafe; color: #1d4ed8; font-weight: 700; }
    .cell-muted { color: #94a3b8; }
    .legend { margin: 10px 0 0; }
    .legend-item { display: inline-block; margin-right: 10px; padding: 5px 8px; border-radius: 999px; font-size: 9pt; font-weight: 700; }
    .legend-correct { background: #dcfce7; color: #166534; }
    .legend-selected { background: #dbeafe; color: #1d4ed8; }
    .legend-wrong { background: #fee2e2; color: #b91c1c; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 10pt; font-weight: 700; }
    .badge-green { background: #dcfce7; color: #166534; }
    .badge-blue { background: #dbeafe; color: #1d4ed8; }
    .badge-slate { background: #e2e8f0; color: #334155; }
    .answer-line { padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 10px; margin-top: 6px; background: #f8fafc; }
    .answer-line.correct { border-color: #86efac; background: #f0fdf4; }
    .answer-line.wrong { border-color: #fca5a5; background: #fef2f2; }
    .subtle { color: #64748b; }
    .rich p { margin: 0 0 6px; }
    .rich ul, .rich ol { margin: 0 0 8px 18px; }
    .rich strong { font-weight: 700; }
    .rich em { font-style: italic; }
    .rich u { text-decoration: underline; }
    .rich s { text-decoration: line-through; }
    .rich sub { vertical-align: sub; font-size: 80%; }
    .rich sup { vertical-align: super; font-size: 80%; }
    .math-inline { display: inline-block; padding: 1px 6px; border-radius: 8px; background: #eff6ff; color: #1d4ed8; font-family: "Times New Roman", Times, serif; font-size: 11pt; }
    .page-break { page-break-before: always; }
  </style>
</head>
<body><div class="doc-shell">
`;

const WORD_HTML_SUFFIX = '</div></body></html>';

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const looksLikeHtml = (content?: string) => !!content && /<\/?[a-z][\s\S]*>/i.test(content);

const sanitizeFileName = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'tai-lieu';

const formatDateTime = (value?: string | number) => {
  if (!value) return 'Chưa cập nhật';
  const date = typeof value === 'string' ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa cập nhật';
  return date.toLocaleString('vi-VN');
};

const stripHtml = (content?: string) => {
  if (!content) return '';
  if (!looksLikeHtml(content)) return content;
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'text/html');
  return (doc.body.textContent || '').trim();
};

const simplifyLatex = (formula: string) => {
  let output = formula;
  output = output.replace(/\\text\{([^}]*)\}/g, '$1');
  output = output.replace(/\\xrightarrow\[([^\]]*)\]\{([^}]*)\}/g, '$2 → $1');
  output = output.replace(/\\xrightarrow\{([^}]*)\}/g, '$1 →');
  output = output.replace(/\\xrightleftharpoons\[([^\]]*)\]\{([^}]*)\}/g, '$2 ⇌ $1');
  output = output.replace(/\\xrightleftharpoons\{([^}]*)\}/g, '$1 ⇌');
  output = output.replace(/\\rightleftharpoons/g, '⇌');
  output = output.replace(/\\rightarrow/g, '→');
  output = output.replace(/\\circ/g, '°');
  output = output.replace(/\\,/g, ' ');
  output = output.replace(/\\/g, '');
  return output.trim();
};

const normalizeRichContent = (content?: string) => {
  if (!content?.trim()) {
    return '<span class="subtle">Chưa nhập nội dung.</span>';
  }

  if (!looksLikeHtml(content)) {
    return escapeHtml(content).replace(/\n/g, '<br/>');
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'text/html');

  doc.body.querySelectorAll('.ql-formula').forEach((node) => {
    const formula = node.getAttribute('data-value') || node.textContent || '';
    const replacement = doc.createElement('span');
    replacement.className = 'math-inline';
    replacement.textContent = simplifyLatex(formula);
    node.replaceWith(replacement);
  });

  doc.body.querySelectorAll('*').forEach((node) => {
    node.removeAttribute('class');
    node.removeAttribute('style');
  });

  return doc.body.innerHTML;
};

const sortedNumericKeys = (record: Record<number, unknown>) =>
  Object.keys(record || {})
    .map(Number)
    .filter((value) => !Number.isNaN(value))
    .sort((a, b) => a - b);

const buildWordBlob = (bodyHtml: string) => {
  return new Blob([WORD_HTML_PREFIX + bodyHtml + WORD_HTML_SUFFIX], {
    type: 'application/msword;charset=utf-8',
  });
};

const downloadBlob = (fileName: string, blob: Blob) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${sanitizeFileName(fileName)}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const downloadWordFile = (fileName: string, bodyHtml: string) => {
  downloadBlob(fileName, buildWordBlob(bodyHtml));
};

const buildMetaGrid = (items: Array<{ label: string; value: string }>) => {
  const rows: string[] = [];
  for (let index = 0; index < items.length; index += 2) {
    const left = items[index];
    const right = items[index + 1];
    rows.push(`
      <tr>
        <td class="meta-card">
          <div class="meta-label">${escapeHtml(left.label)}</div>
          <div class="meta-value">${escapeHtml(left.value)}</div>
        </td>
        ${
          right
            ? `<td class="meta-card">
                <div class="meta-label">${escapeHtml(right.label)}</div>
                <div class="meta-value">${escapeHtml(right.value)}</div>
              </td>`
            : '<td class="meta-card"></td>'
        }
      </tr>
    `);
  }
  return `<table class="meta-grid">${rows.join('')}</table>`;
};

const renderChoiceLines = (choices?: Record<string, string>, correctAnswer?: string) => {
  const options = ['A', 'B', 'C', 'D'];
  return `
    <table class="choice-grid">
      <tr>
        ${options
          .map((option) => {
            const isCorrect = correctAnswer === option;
            return `
              <td>
                <div class="choice-row${isCorrect ? ' cell-correct' : ''}">
                  <span class="choice-label">${option}.</span>
                  <span class="rich">${normalizeRichContent(choices?.[option])}</span>
                </div>
              </td>
            `;
          })
          .join('')}
      </tr>
    </table>
  `;
};

const renderStatementLines = (
  statements: Record<string, string> | undefined,
  answers: Record<string, boolean> | undefined
) => {
  const labels = ['a', 'b', 'c', 'd'];
  return labels
    .map((label) => `
      <div class="statement-row">
        <span class="statement-label">${label})</span>
        <span class="rich">${normalizeRichContent(statements?.[label])}</span>
        ${
          answers
            ? ` <span class="badge ${answers[label] ? 'badge-green' : 'badge-slate'}">${answers[label] ? 'Đúng' : 'Sai'}</span>`
            : ''
        }
      </div>
    `)
    .join('');
};

const renderExplanationBlock = ({
  explanation,
  hint,
  similarQuestion,
  similarAnswer,
}: {
  explanation?: string;
  hint?: string;
  similarQuestion?: string;
  similarAnswer?: string;
}) => {
  const rows: string[] = [];

  if (explanation?.trim()) {
    rows.push(`
      <div class="answer-line correct">
        <strong>Lời giải chi tiết:</strong>
        <div class="rich">${normalizeRichContent(explanation)}</div>
      </div>
    `);
  }

  if (hint?.trim()) {
    rows.push(`
      <div class="answer-line">
        <strong>Gợi ý:</strong>
        <div class="rich">${normalizeRichContent(hint)}</div>
      </div>
    `);
  }

  if (similarQuestion?.trim() || similarAnswer?.trim()) {
    rows.push(`
      <div class="answer-line">
        <strong>Câu hỏi tương tự:</strong>
        <div class="rich">${normalizeRichContent(similarQuestion || '')}</div>
        ${
          similarAnswer?.trim()
            ? `<div class="subtle" style="margin-top:6px;"><strong>Đáp án tham khảo:</strong> ${escapeHtml(similarAnswer)}</div>`
            : ''
        }
      </div>
    `);
  }

  return rows.join('');
};

const buildBlankAnswerSheet = (exam: Exam) => {
  const part1Keys = sortedNumericKeys(exam.part1);
  const part2Keys = sortedNumericKeys(exam.part2);
  const part3Keys = sortedNumericKeys(exam.part3);

  return `
    <div class="section-card">
      <div class="section-title">Phiếu trả lời trắc nghiệm</div>
      <div class="section-note">Mẫu này dùng để in phiếu trả lời cho học sinh khi đề gốc được phát trên giấy.</div>
      ${
        part1Keys.length > 0
          ? `
            <h4>Phần I. Trắc nghiệm nhiều lựa chọn</h4>
            <table class="answer-sheet">
              <thead><tr><th class="question-col">Câu</th><th>A</th><th>B</th><th>C</th><th>D</th></tr></thead>
              <tbody>
                ${part1Keys
                  .map(
                    (qNum) => `
                      <tr>
                        <td class="question-col">${qNum}</td>
                        <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
                      </tr>
                    `
                  )
                  .join('')}
              </tbody>
            </table>
          `
          : ''
      }
      ${
        part2Keys.length > 0
          ? `
            <h4 style="margin-top:12px;">Phần II. Đúng / Sai</h4>
            <table class="answer-sheet">
              <thead><tr><th class="question-col">Câu</th><th>a</th><th>b</th><th>c</th><th>d</th></tr></thead>
              <tbody>
                ${part2Keys
                  .map(
                    (qNum) => `
                      <tr>
                        <td class="question-col">${qNum}</td>
                        <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
                      </tr>
                    `
                  )
                  .join('')}
              </tbody>
            </table>
          `
          : ''
      }
      ${
        part3Keys.length > 0
          ? `
            <h4 style="margin-top:12px;">Phần III. Trả lời ngắn</h4>
            ${part3Keys
              .map(
                (qNum) => `
                  <div class="answer-line">
                    <strong>Câu ${qNum}:</strong> ..........................................................................................................
                  </div>
                `
              )
              .join('')}
          `
          : ''
      }
    </div>
  `;
};

const buildExamQuestions = (exam: Exam) => {
  const part1Keys = sortedNumericKeys(exam.part1);
  const part2Keys = sortedNumericKeys(exam.part2);
  const part3Keys = sortedNumericKeys(exam.part3);

  const sections: string[] = [];

  if (part1Keys.length > 0) {
    sections.push(`
      <div class="section-card">
        <div class="section-title">Phần I. Câu hỏi trắc nghiệm</div>
        ${part1Keys
          .map((qNum) => {
            const question = exam.part1[qNum];
            return `
              <div class="question-block">
                <div class="question-title">Câu ${qNum}</div>
                <div class="question-content rich">${normalizeRichContent(question.question)}</div>
                ${renderChoiceLines(question.choices)}
              </div>
            `;
          })
          .join('')}
      </div>
    `);
  }

  if (part2Keys.length > 0) {
    sections.push(`
      <div class="section-card">
        <div class="section-title">Phần II. Câu hỏi đúng / sai</div>
        ${part2Keys
          .map((qNum) => {
            const question = exam.part2[qNum];
            return `
              <div class="question-block">
                <div class="question-title">Câu ${qNum}</div>
                <div class="question-content rich">${normalizeRichContent(question.question)}</div>
                ${renderStatementLines(question.statements, undefined)}
              </div>
            `;
          })
          .join('')}
      </div>
    `);
  }

  if (part3Keys.length > 0) {
    sections.push(`
      <div class="section-card">
        <div class="section-title">Phần III. Câu hỏi trả lời ngắn</div>
        ${part3Keys
          .map((qNum) => {
            const question = exam.part3[qNum];
            return `
              <div class="question-block">
                <div class="question-title">Câu ${qNum}</div>
                <div class="question-content rich">${normalizeRichContent(question.question)}</div>
                <div class="answer-line"><strong>Trả lời:</strong> .............................................................................</div>
              </div>
            `;
          })
          .join('')}
      </div>
    `);
  }

  return sections.join('');
};

const buildAnswerKeySheet = (exam: Exam) => {
  const part1Keys = sortedNumericKeys(exam.part1);
  const part2Keys = sortedNumericKeys(exam.part2);
  const part3Keys = sortedNumericKeys(exam.part3);

  return `
    <div class="section-card">
      <div class="section-title">Phiếu đáp án chuẩn</div>
      <div class="section-note">Đáp án đúng được tô xanh để giáo viên in và đối chiếu nhanh.</div>
      ${
        part1Keys.length > 0
          ? `
            <h4>Phần I. Trắc nghiệm nhiều lựa chọn</h4>
            <table class="answer-sheet">
              <thead><tr><th class="question-col">Câu</th><th>A</th><th>B</th><th>C</th><th>D</th></tr></thead>
              <tbody>
                ${part1Keys
                  .map((qNum) => {
                    const answer = (exam.part1[qNum]?.answer || '').toUpperCase();
                    return `
                      <tr>
                        <td class="question-col">${qNum}</td>
                        ${['A', 'B', 'C', 'D']
                          .map((option) => `<td class="${answer === option ? 'cell-correct' : ''}">${option}</td>`)
                          .join('')}
                      </tr>
                    `;
                  })
                  .join('')}
              </tbody>
            </table>
          `
          : ''
      }
      ${
        part2Keys.length > 0
          ? `
            <h4 style="margin-top:12px;">Phần II. Đúng / Sai</h4>
            <table class="answer-sheet">
              <thead><tr><th class="question-col">Câu</th><th>a</th><th>b</th><th>c</th><th>d</th></tr></thead>
              <tbody>
                ${part2Keys
                  .map((qNum) => {
                    const answers = exam.part2[qNum]?.answers || {};
                    return `
                      <tr>
                        <td class="question-col">${qNum}</td>
                        ${['a', 'b', 'c', 'd']
                          .map((label) => `<td class="${answers[label] ? 'cell-correct' : ''}">${answers[label] ? 'Đúng' : 'Sai'}</td>`)
                          .join('')}
                      </tr>
                    `;
                  })
                  .join('')}
              </tbody>
            </table>
          `
          : ''
      }
      ${
        part3Keys.length > 0
          ? `
            <h4 style="margin-top:12px;">Phần III. Trả lời ngắn</h4>
            ${part3Keys
              .map((qNum) => `
                <div class="answer-line correct">
                  <strong>Câu ${qNum}:</strong> ${escapeHtml(exam.part3[qNum]?.answer || 'Chưa nhập')}
                </div>
              `)
              .join('')}
          `
          : ''
      }
      <div class="legend">
        <span class="legend-item legend-correct">Ô xanh: đáp án đúng</span>
      </div>
    </div>
  `;
};

const buildDetailedAnswerKey = (exam: Exam) => {
  const blocks: string[] = [];

  for (const qNum of sortedNumericKeys(exam.part1)) {
    const question = exam.part1[qNum];
    if (!question.answer && !question.explanation && !question.hint && !question.similarExercise) continue;
    blocks.push(`
      <div class="question-block">
        <div class="question-title">Phần I - Câu ${qNum}</div>
        <div class="answer-line correct"><strong>Đáp án đúng:</strong> ${escapeHtml(question.answer || 'Chưa chọn')}</div>
        ${renderExplanationBlock({
          explanation: question.explanation,
          hint: question.hint,
          similarQuestion: question.similarExercise?.question,
          similarAnswer: question.similarExercise?.answer,
        })}
      </div>
    `);
  }

  for (const qNum of sortedNumericKeys(exam.part2)) {
    const question = exam.part2[qNum];
    const explanationRows = ['a', 'b', 'c', 'd']
      .map((label) => {
        const info = question.explanations?.[label];
        if (!info?.explanation && !info?.hint && !info?.similarExercise) return '';
        return `
          <div class="answer-line">
            <strong>Ý ${label})</strong>
            ${renderExplanationBlock({
              explanation: info?.explanation,
              hint: info?.hint,
              similarQuestion: info?.similarExercise?.question,
              similarAnswer: info?.similarExercise?.answer,
            })}
          </div>
        `;
      })
      .join('');

    if (!question.explanation && !question.hint && !explanationRows) continue;

    blocks.push(`
      <div class="question-block">
        <div class="question-title">Phần II - Câu ${qNum}</div>
        ${
          question.explanation
            ? `<div class="answer-line correct"><strong>Lời giải tổng quát:</strong><div class="rich">${normalizeRichContent(question.explanation)}</div></div>`
            : ''
        }
        ${question.hint ? `<div class="answer-line"><strong>Gợi ý:</strong><div class="rich">${normalizeRichContent(question.hint)}</div></div>` : ''}
        ${explanationRows}
      </div>
    `);
  }

  for (const qNum of sortedNumericKeys(exam.part3)) {
    const question = exam.part3[qNum];
    if (!question.answer && !question.explanation && !question.hint && !question.similarExercise) continue;
    blocks.push(`
      <div class="question-block">
        <div class="question-title">Phần III - Câu ${qNum}</div>
        <div class="answer-line correct"><strong>Đáp án đúng:</strong> ${escapeHtml(question.answer || 'Chưa nhập')}</div>
        ${renderExplanationBlock({
          explanation: question.explanation,
          hint: question.hint,
          similarQuestion: question.similarExercise?.question,
          similarAnswer: question.similarExercise?.answer,
        })}
      </div>
    `);
  }

  if (blocks.length === 0) return '';

  return `
    <div class="section-card">
      <div class="section-title">Lời giải chi tiết và câu hỏi tương tự</div>
      ${blocks.join('')}
    </div>
  `;
};

const getPart1AnswerCellClass = (studentAnswer: string | undefined, correctAnswer: string, option: string) => {
  if (studentAnswer === option && correctAnswer === option) return 'cell-correct';
  if (studentAnswer === option && correctAnswer !== option) return 'cell-wrong';
  if (studentAnswer !== option && correctAnswer === option) return 'cell-selected';
  return '';
};

const buildStudentAttemptSheet = (exam: Exam, attempt: Attempt) => {
  const part1Keys = sortedNumericKeys(exam.part1);
  const part2Keys = sortedNumericKeys(exam.part2);
  const part3Keys = sortedNumericKeys(exam.part3);

  return `
    <div class="section-card">
      <div class="section-title">Phiếu đáp án bài làm của học sinh</div>
      <div class="section-note">Màu xanh lá: học sinh làm đúng. Màu đỏ: học sinh chọn sai. Màu xanh dương: đáp án đúng để đối chiếu.</div>
      ${
        part1Keys.length > 0
          ? `
            <h4>Phần I. Trắc nghiệm nhiều lựa chọn</h4>
            <table class="answer-sheet">
              <thead><tr><th class="question-col">Câu</th><th>A</th><th>B</th><th>C</th><th>D</th></tr></thead>
              <tbody>
                ${part1Keys
                  .map((qNum) => {
                    const correct = (exam.part1[qNum]?.answer || '').toUpperCase();
                    const studentAnswer = (attempt.answersPart1[qNum] || '').toUpperCase();
                    return `
                      <tr>
                        <td class="question-col">${qNum}</td>
                        ${['A', 'B', 'C', 'D']
                          .map((option) => `<td class="${getPart1AnswerCellClass(studentAnswer, correct, option)}">${option}</td>`)
                          .join('')}
                      </tr>
                    `;
                  })
                  .join('')}
              </tbody>
            </table>
          `
          : ''
      }
      ${
        part2Keys.length > 0
          ? `
            <h4 style="margin-top:12px;">Phần II. Đúng / Sai</h4>
            <table class="answer-sheet">
              <thead><tr><th class="question-col">Câu</th><th>a</th><th>b</th><th>c</th><th>d</th></tr></thead>
              <tbody>
                ${part2Keys
                  .map((qNum) => {
                    const correctAnswers = exam.part2[qNum]?.answers || {};
                    const studentAnswers = attempt.answersPart2[qNum] || {};
                    return `
                      <tr>
                        <td class="question-col">${qNum}</td>
                        ${['a', 'b', 'c', 'd']
                          .map((label) => {
                            const studentValue = studentAnswers[label];
                            const correctValue = correctAnswers[label];
                            let cellClass = '';
                            if (studentValue === undefined) {
                              cellClass = correctValue !== undefined ? 'cell-selected' : '';
                            } else if (studentValue === correctValue) {
                              cellClass = 'cell-correct';
                            } else {
                              cellClass = 'cell-wrong';
                            }
                            return `<td class="${cellClass}">${studentValue === undefined ? 'Trống' : studentValue ? 'Đúng' : 'Sai'}</td>`;
                          })
                          .join('')}
                      </tr>
                    `;
                  })
                  .join('')}
              </tbody>
            </table>
          `
          : ''
      }
      ${
        part3Keys.length > 0
          ? `
            <h4 style="margin-top:12px;">Phần III. Trả lời ngắn</h4>
            ${part3Keys
              .map((qNum) => {
                const studentAnswer = (attempt.answersPart3[qNum] || '').trim();
                const correctAnswer = (exam.part3[qNum]?.answer || '').trim();
                const isCorrect = !!studentAnswer && studentAnswer.toLowerCase() === correctAnswer.toLowerCase();
                return `
                  <div class="answer-line ${isCorrect ? 'correct' : 'wrong'}">
                    <strong>Câu ${qNum}:</strong>
                    <div>Học sinh trả lời: ${escapeHtml(studentAnswer || 'Bỏ trống')}</div>
                    <div>Đáp án đúng: ${escapeHtml(correctAnswer || 'Chưa nhập')}</div>
                  </div>
                `;
              })
              .join('')}
          `
          : ''
      }
      <div class="legend">
        <span class="legend-item legend-correct">Đúng</span>
        <span class="legend-item legend-selected">Đáp án chuẩn</span>
        <span class="legend-item legend-wrong">Sai</span>
      </div>
    </div>
  `;
};

const buildStudentDetailedReview = (exam: Exam, attempt: Attempt) => {
  const blocks: string[] = [];

  for (const qNum of sortedNumericKeys(exam.part1)) {
    const question = exam.part1[qNum];
    const studentAnswer = attempt.answersPart1[qNum];
    const correctAnswer = question.answer;
    blocks.push(`
      <div class="question-block">
        <div class="question-title">Phần I - Câu ${qNum}</div>
        ${
          question.question
            ? `<div class="question-content rich">${normalizeRichContent(question.question)}</div>`
            : ''
        }
        <div class="answer-line ${studentAnswer === correctAnswer ? 'correct' : 'wrong'}">
          <div><strong>Học sinh chọn:</strong> ${escapeHtml(studentAnswer || 'Bỏ trống')}</div>
          <div><strong>Đáp án đúng:</strong> ${escapeHtml(correctAnswer || 'Chưa nhập')}</div>
        </div>
        ${renderExplanationBlock({
          explanation: question.explanation,
          hint: question.hint,
          similarQuestion: question.similarExercise?.question,
          similarAnswer: question.similarExercise?.answer,
        })}
      </div>
    `);
  }

  for (const qNum of sortedNumericKeys(exam.part2)) {
    const question = exam.part2[qNum];
    const detailRows = ['a', 'b', 'c', 'd']
      .map((label) => {
        const studentValue = attempt.answersPart2[qNum]?.[label];
        const correctValue = question.answers?.[label];
        const explanation = question.explanations?.[label];
        return `
          <div class="answer-line ${
            studentValue !== undefined && studentValue === correctValue ? 'correct' : 'wrong'
          }">
            <div><strong>Ý ${label})</strong> Học sinh: ${studentValue === undefined ? 'Bỏ trống' : studentValue ? 'Đúng' : 'Sai'} | Đáp án: ${
              correctValue ? 'Đúng' : 'Sai'
            }</div>
            ${
              explanation?.explanation
                ? `<div class="rich" style="margin-top:6px;">${normalizeRichContent(explanation.explanation)}</div>`
                : ''
            }
          </div>
        `;
      })
      .join('');

    blocks.push(`
      <div class="question-block">
        <div class="question-title">Phần II - Câu ${qNum}</div>
        ${
          question.question
            ? `<div class="question-content rich">${normalizeRichContent(question.question)}</div>`
            : ''
        }
        ${detailRows}
      </div>
    `);
  }

  for (const qNum of sortedNumericKeys(exam.part3)) {
    const question = exam.part3[qNum];
    const studentAnswer = (attempt.answersPart3[qNum] || '').trim();
    const correctAnswer = (question.answer || '').trim();
    const isCorrect = !!studentAnswer && studentAnswer.toLowerCase() === correctAnswer.toLowerCase();
    blocks.push(`
      <div class="question-block">
        <div class="question-title">Phần III - Câu ${qNum}</div>
        ${
          question.question
            ? `<div class="question-content rich">${normalizeRichContent(question.question)}</div>`
            : ''
        }
        <div class="answer-line ${isCorrect ? 'correct' : 'wrong'}">
          <div><strong>Học sinh trả lời:</strong> ${escapeHtml(studentAnswer || 'Bỏ trống')}</div>
          <div><strong>Đáp án đúng:</strong> ${escapeHtml(correctAnswer || 'Chưa nhập')}</div>
        </div>
        ${renderExplanationBlock({
          explanation: question.explanation,
          hint: question.hint,
          similarQuestion: question.similarExercise?.question,
          similarAnswer: question.similarExercise?.answer,
        })}
      </div>
    `);
  }

  return `
    <div class="section-card page-break">
      <div class="section-title">Đối chiếu chi tiết bài làm</div>
      ${blocks.join('')}
    </div>
  `;
};

export const exportExamToWord = (exam: Exam) => {
  const isFullExam = exam.templateType === 'ONLINE_EXAM';
  const header = `
    <div class="doc-header">
      <div class="doc-kicker">${isFullExam ? 'Đề thi online' : 'Phiếu học tập online'}</div>
      <div class="doc-title">${escapeHtml(exam.title)}</div>
      ${
        exam.description
          ? `<div class="doc-subtitle">${escapeHtml(stripHtml(exam.description) || exam.description)}</div>`
          : ''
      }
      ${buildMetaGrid([
        { label: 'Môn học', value: exam.subject || 'Chưa chọn môn' },
        { label: 'Khối/Lớp', value: exam.grade || 'Chưa chọn khối/lớp' },
        { label: 'Thời gian', value: `${exam.onlineSettings?.durationMinutes || 50} phút` },
        { label: 'Tổng điểm', value: `${exam.onlineSettings?.totalScore || 10} điểm` },
      ])}
    </div>
  `;

  const body = `
    ${header}
    ${
      exam.instructions
        ? `<div class="section-card"><div class="section-title">Hướng dẫn làm bài</div><div class="rich">${normalizeRichContent(exam.instructions)}</div></div>`
        : ''
    }
    ${isFullExam ? buildExamQuestions(exam) : buildBlankAnswerSheet(exam)}
  `;

  downloadWordFile(`${exam.title}-de-thi`, body);
};

export const buildExamWordBlob = (exam: Exam) => {
  const isFullExam = exam.templateType === 'ONLINE_EXAM';
  const header = `
    <div class="doc-header">
      <div class="doc-kicker">${isFullExam ? 'Đề thi online' : 'Phiếu học tập online'}</div>
      <div class="doc-title">${escapeHtml(exam.title)}</div>
      ${
        exam.description
          ? `<div class="doc-subtitle">${escapeHtml(stripHtml(exam.description) || exam.description)}</div>`
          : ''
      }
      ${buildMetaGrid([
        { label: 'Môn học', value: exam.subject || 'Chưa chọn môn' },
        { label: 'Khối/Lớp', value: exam.grade || 'Chưa chọn khối/lớp' },
        { label: 'Thời gian', value: `${exam.onlineSettings?.durationMinutes || 50} phút` },
        { label: 'Tổng điểm', value: `${exam.onlineSettings?.totalScore || 10} điểm` },
      ])}
    </div>
  `;
  const body = `
    ${header}
    ${
      exam.instructions
        ? `<div class="section-card"><div class="section-title">Hướng dẫn làm bài</div><div class="rich">${normalizeRichContent(exam.instructions)}</div></div>`
        : ''
    }
    ${isFullExam ? buildExamQuestions(exam) : buildBlankAnswerSheet(exam)}
  `;
  return buildWordBlob(body);
};

export const exportAnswerKeyToWord = (exam: Exam) => {
  const body = `
    <div class="doc-header">
      <div class="doc-kicker">Đáp án chuẩn</div>
      <div class="doc-title">${escapeHtml(exam.title)}</div>
      <div class="doc-subtitle">Xuất theo mẫu phiếu đáp án của hệ thống, đáp án đúng được tô xanh để in và đối chiếu.</div>
      ${buildMetaGrid([
        { label: 'Môn học', value: exam.subject || 'Chưa chọn môn' },
        { label: 'Khối/Lớp', value: exam.grade || 'Chưa chọn khối/lớp' },
        { label: 'Loại đề', value: exam.templateType === 'ONLINE_EXAM' ? 'Đề thi đầy đủ' : 'Phiếu đáp án' },
        { label: 'Cập nhật', value: formatDateTime(exam.updatedAt || exam.createdAt) },
      ])}
    </div>
    ${buildAnswerKeySheet(exam)}
    ${buildDetailedAnswerKey(exam)}
  `;

  downloadWordFile(`${exam.title}-dap-an`, body);
};

export const buildAnswerKeyWordBlob = (exam: Exam) => {
  const body = `
    <div class="doc-header">
      <div class="doc-kicker">Đáp án chuẩn</div>
      <div class="doc-title">${escapeHtml(exam.title)}</div>
      <div class="doc-subtitle">Xuất theo mẫu phiếu đáp án của hệ thống, đáp án đúng được tô xanh để in và đối chiếu.</div>
      ${buildMetaGrid([
        { label: 'Môn học', value: exam.subject || 'Chưa chọn môn' },
        { label: 'Khối/Lớp', value: exam.grade || 'Chưa chọn khối/lớp' },
        { label: 'Loại đề', value: exam.templateType === 'ONLINE_EXAM' ? 'Đề thi đầy đủ' : 'Phiếu đáp án' },
        { label: 'Cập nhật', value: formatDateTime(exam.updatedAt || exam.createdAt) },
      ])}
    </div>
    ${buildAnswerKeySheet(exam)}
    ${buildDetailedAnswerKey(exam)}
  `;
  return buildWordBlob(body);
};

export const exportStudentAttemptToWord = ({
  exam,
  attempt,
  student,
  assignment,
  className,
}: {
  exam: Exam;
  attempt: Attempt;
  student?: Student;
  assignment?: Assignment;
  className?: string;
}) => {
  const body = `
    <div class="doc-header">
      <div class="doc-kicker">Bài làm học sinh</div>
      <div class="doc-title">${escapeHtml(exam.title)}</div>
      <div class="doc-subtitle">Phiếu bài làm xuất từ hệ thống, có đối chiếu với đáp án chuẩn để giáo viên lưu trữ hoặc gửi lại cho học sinh.</div>
      ${buildMetaGrid([
        { label: 'Học sinh', value: student?.fullName || 'Không xác định' },
        { label: 'SBD', value: student?.sbd || 'Không xác định' },
        { label: 'Lớp', value: className || 'Không xác định' },
        { label: 'Điểm', value: `${(attempt.score || 0).toFixed(2)} / 10` },
        { label: 'Thời điểm nộp', value: formatDateTime(attempt.submittedAt) },
        { label: 'Thời gian làm', value: attempt.durationSeconds ? `${Math.floor(attempt.durationSeconds / 60)} phút ${attempt.durationSeconds % 60} giây` : 'Không xác định' },
        { label: 'Chế độ', value: assignment?.mode === 'PRACTICE' ? 'Ôn luyện' : 'Thi online' },
        { label: 'Chuyển tab', value: `${attempt.tabSwitchCount || 0} lần` },
      ])}
    </div>
    ${buildStudentAttemptSheet(exam, attempt)}
    ${buildStudentDetailedReview(exam, attempt)}
  `;

  downloadWordFile(`${exam.title}-${student?.fullName || 'hoc-sinh'}-bai-lam`, body);
};

export const exportMixedVersionsZip = async ({
  originalExam,
  versions,
}: {
  originalExam: Exam;
  versions: ExamVersion[];
}) => {
  const zip = new JSZip();
  const folder = zip.folder(sanitizeFileName(`${originalExam.title}-ma-de`));
  if (!folder) return;

  const isLegacySheet = originalExam.templateType === 'LEGACY_PHIU_TRA_LOI';

  if (isLegacySheet) {
    // Phiếu in giấy: các mã đề KHÔNG trộn câu hỏi → nội dung đề giống nhau
    // → Chỉ xuất 1 file đề gốc + file đáp án riêng cho từng mã đề
    folder.file(
      `${sanitizeFileName(`${originalExam.title}-de-goc`)}.doc`,
      buildExamWordBlob(originalExam)
    );
    versions.forEach((version) => {
      folder.file(
        `dap-an-ma-${version.code}.doc`,
        buildAnswerKeyWordBlob(version.derivedExam)
      );
    });
  } else {
    // Đề online: mọi mã đề có thứ tự câu KHAAC nhau → xuất cả đề + đáp án từng mã
    versions.forEach((version) => {
      folder.file(
        `${sanitizeFileName(`${originalExam.title}-ma-de-${version.code}`)}.doc`,
        buildExamWordBlob(version.derivedExam)
      );
      folder.file(
        `${sanitizeFileName(`${originalExam.title}-dap-an-ma-de-${version.code}`)}.doc`,
        buildAnswerKeyWordBlob(version.derivedExam)
      );
    });
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(zipBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${sanitizeFileName(`${originalExam.title}-bo-ma-de`)}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
