import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  PageOrientation,
} from 'docx';
import { ExamVersion } from '@/types';

function p(text: string, options?: { bold?: boolean; color?: string; size?: number; heading?: any; alignment?: any }) {
  return new Paragraph({
    heading: options?.heading,
    alignment: options?.alignment,
    spacing: { after: 120 },
    children: [
      new TextRun({
        text,
        bold: options?.bold,
        color: options?.color,
        size: options?.size || 22, // 11pt
        font: 'Times New Roman',
      }),
    ],
  });
}

function createCell(text: string, widthPercent: number, bold = false) {
  return new TableCell({
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
      left: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
      right: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
    },
    margins: { top: 60, bottom: 60, left: 60, right: 60 },
    children: [p(text, { bold, size: 20 })], // 10pt
  });
}

function createEmptyCell(widthPercent: number) {
  return new TableCell({
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
      left: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
      right: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
    },
    margins: { top: 60, bottom: 60, left: 60, right: 60 },
    children: [p('')],
  });
}

export async function downloadMixingAnswerKeyTemplate(versions: ExamVersion[]) {
  const codes = versions.map((v) => v.code);
  const numOfCodes = codes.length;

  const colWidthCau = 6;
  const colWidthLoiGiai = 30; // 30% for explanation
  const remainingWidth = 100 - colWidthCau - colWidthLoiGiai;
  const colWidthCode = remainingWidth / numOfCodes;

  // ---- PHẦN I ----
  const part1Rows: TableRow[] = [
    new TableRow({
      children: [
        createCell('Câu', colWidthCau, true),
        createCell('Lời Giải', colWidthLoiGiai, true),
        ...codes.map((code) => createCell(code, colWidthCode, true)),
      ],
    }),
  ];

  for (let i = 1; i <= 18; i++) {
    part1Rows.push(
      new TableRow({
        children: [
          createCell(String(i), colWidthCau, true),
          createEmptyCell(colWidthLoiGiai),
          ...codes.map(() => createEmptyCell(colWidthCode)),
        ],
      })
    );
  }

  // ---- PHẦN II ----
  const part2Rows: TableRow[] = [
    new TableRow({
      children: [
        createCell('Ý', colWidthCau, true),
        createCell('Lời Giải', colWidthLoiGiai, true),
        ...codes.map((code) => createCell(code, colWidthCode, true)),
      ],
    }),
  ];

  for (let i = 1; i <= 4; i++) {
    ['a', 'b', 'c', 'd'].forEach((sub) => {
      part2Rows.push(
        new TableRow({
          children: [
            createCell(`${i}${sub}`, colWidthCau, true),
            createEmptyCell(colWidthLoiGiai),
            ...codes.map(() => createEmptyCell(colWidthCode)),
          ],
        })
      );
    });
  }

  // ---- PHẦN III ----
  const part3Rows: TableRow[] = [
    new TableRow({
      children: [
        createCell('Câu', colWidthCau, true),
        createCell('Lời Giải', colWidthLoiGiai, true),
        ...codes.map((code) => createCell(code, colWidthCode, true)),
      ],
    }),
  ];

  for (let i = 1; i <= 6; i++) {
    part3Rows.push(
      new TableRow({
        children: [
          createCell(String(i), colWidthCau, true),
          createEmptyCell(colWidthLoiGiai),
          ...codes.map(() => createEmptyCell(colWidthCode)),
        ],
      })
    );
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Times New Roman', size: 22 },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 500, right: 500, bottom: 500, left: 500 }, // ~0.35 inch
            size: {
              orientation: PageOrientation.LANDSCAPE,
            },
          },
        },
        children: [
          p(`MẪU ĐÁP ÁN GỘP CHO ${numOfCodes} MÃ ĐỀ`, { heading: HeadingLevel.TITLE, bold: true, color: '0F766E', alignment: AlignmentType.CENTER }),
          p('HƯỚNG DẪN:', { bold: true, color: 'B91C1C' }),
          p('- Lời giải (cột thứ 2) ở mỗi dòng sẽ được áp dụng chung cho câu hỏi cùng dòng ở TẤT CẢ các mã đề.', { color: '475569' }),
          p('- Phần I: Nhập A, B, C, hoặc D.', { color: '475569' }),
          p('- Phần II: Nhập Đ (Đúng) hoặc S (Sai).', { color: '475569' }),
          p('- Phần III: Nhập con số, ví dụ 0.5, -2, hoặc 12.', { color: '475569' }),

          p('[DAP_AN_PHAN_1]', { heading: HeadingLevel.HEADING_1, bold: true, color: '0F766E' }),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: part1Rows }),
          p('', { size: 12 }),

          p('[DAP_AN_PHAN_2]', { heading: HeadingLevel.HEADING_1, bold: true, color: '0F766E' }),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: part2Rows }),
          p('', { size: 12 }),

          p('[DAP_AN_PHAN_3]', { heading: HeadingLevel.HEADING_1, bold: true, color: '0F766E' }),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: part3Rows }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `mau-dap-an-gop-${numOfCodes}-ma-de.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
