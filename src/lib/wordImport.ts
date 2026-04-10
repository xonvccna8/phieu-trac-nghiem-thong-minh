import mammoth from 'mammoth';
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
} from 'docx';
import { parseExamFromWordText, type ParsedWordExam } from '@/lib/wordImportShared';
import { inspectDocxSemantics } from '@/lib/docxSemantics';

async function convertImageToDataUri(image: any) {
  const base64 = await image.readAsBase64String();
  const contentType = image.contentType || 'image/png';
  return {
    src: `data:${contentType};base64,${base64}`,
  };
}

export async function parseExamFromWordFile(file: File): Promise<ParsedWordExam> {
  if (!file.name.toLowerCase().endsWith('.docx')) {
    throw new Error('Hiện tại hệ thống import ổn định nhất với file .docx. Hãy tải mẫu chuẩn và lưu dưới dạng .docx trước khi tải lên.');
  }

  const arrayBuffer = await file.arrayBuffer();
  const { value } = await mammoth.extractRawText({ arrayBuffer });
  return parseExamFromWordText(value);
}

export async function wordFileNeedsRichImport(file: File): Promise<boolean> {
  if (!file.name.toLowerCase().endsWith('.docx')) return false;
  const arrayBuffer = await file.arrayBuffer();
  const semantics = await inspectDocxSemantics(arrayBuffer);
  const { value } = await mammoth.convertToHtml(
    { arrayBuffer },
    { convertImage: mammoth.images.imgElement(convertImageToDataUri) }
  );

  return semantics.containsImages || semantics.containsMath || /<img\b/i.test(value);
}

function paragraph(text: string, options?: { bold?: boolean; color?: string; size?: number; heading?: HeadingLevel; alignment?: AlignmentType }) {
  return new Paragraph({
    heading: options?.heading,
    alignment: options?.alignment,
    spacing: { after: 180 },
    children: [
      new TextRun({
        text,
        bold: options?.bold,
        color: options?.color,
        size: options?.size || 24,
        font: 'Times New Roman',
      }),
    ],
  });
}

function infoTableRow(left: string, right: string) {
  return new TableRow({
    children: [left, right].map((text) => new TableCell({
      width: { size: 50, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
        left: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
        right: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
      },
      margins: { top: 80, bottom: 80, left: 100, right: 100 },
      children: [paragraph(text)],
    })),
  });
}

function choiceRow(a: string, b: string, c: string, d: string) {
  return new TableRow({
    children: [a, b, c, d].map((text) => new TableCell({
      width: { size: 25, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
        left: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
        right: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
      },
      margins: { top: 80, bottom: 80, left: 80, right: 80 },
      children: [paragraph(text)],
    })),
  });
}

export async function downloadWordImportTemplate() {
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Times New Roman',
            size: 24,
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 567,
              right: 567,
              bottom: 567,
              left: 567,
            },
          },
        },
        children: [
          paragraph('Mau File Word Chuan - Phieu Tra Loi Trac Nghiem Thong Minh', {
            heading: HeadingLevel.TITLE,
            bold: true,
            color: '0F766E',
            alignment: AlignmentType.CENTER,
          }),
          paragraph('Huong dan nhanh', { heading: HeadingLevel.HEADING_1, bold: true, color: '0F172A' }),
          paragraph('1. Khuyen nghi su dung file .docx de he thong doc on dinh nhat.'),
          paragraph('2. Giu nguyen cac nhan nhu [THONG_TIN], [PHAN_1], CAU 1:, DAP_AN:, LOI_GIAI: ...'),
          paragraph('3. Ban co the de trong cac dong khong dung den, sau khi import van sua lai duoc tren web.'),
          paragraph('4. LOAI_DE chi nhan ONLINE_EXAM hoac LEGACY_PHIU_TRA_LOI.', { bold: true, color: '2563EB' }),
          paragraph('[THONG_TIN]', { heading: HeadingLevel.HEADING_1, bold: true, color: '0F766E' }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              infoTableRow('TIEU_DE: Khao sat chat luong mon Toan lop 12 - De 01', 'MON_HOC: Toan'),
              infoTableRow('KHOI_LOP: Khoi 12', 'LOAI_DE: ONLINE_EXAM'),
              infoTableRow('THOI_GIAN: 50', 'TONG_DIEM: 10'),
              infoTableRow('SO_LAN_LAM: 1', 'Trang thai mac dinh: DRAFT'),
            ],
          }),
          paragraph('MO_TA:'),
          paragraph('De danh gia nang luc cuoi chuong.'),
          paragraph('HUONG_DAN:'),
          paragraph('Hoc sinh doc ky de, lam phan I truoc, sau do den phan II va III.'),
          paragraph('[PHAN_1]', { heading: HeadingLevel.HEADING_1, bold: true, color: '0F766E' }),
          paragraph('CAU 1:', { bold: true }),
          paragraph('NOI_DUNG: Gia tri cua bieu thuc x^2 + 1 khi x = 2 la bao nhieu?'),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [choiceRow('A: 3', 'B: 4', 'C: 5', 'D: 6')],
          }),
          paragraph('DAP_AN: C'),
          paragraph('LOI_GIAI: Thay x = 2 vao bieu thuc, ta co 2^2 + 1 = 5.'),
          paragraph('GOI_Y: Tinh binh phuong truoc, cong 1 sau.'),
          paragraph('CAU_TUONG_TU: Tinh gia tri cua x^2 + 3 khi x = 2.'),
          paragraph('DAP_AN_TUONG_TU: 7'),
          paragraph('CAU 2:', { bold: true }),
          paragraph('NOI_DUNG:'),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [choiceRow('A:', 'B:', 'C:', 'D:')],
          }),
          paragraph('DAP_AN:'),
          paragraph('[PHAN_2]', { heading: HeadingLevel.HEADING_1, bold: true, color: '0F766E' }),
          paragraph('CAU 1:', { bold: true }),
          paragraph('NOI_DUNG: Xet cac phat bieu sau ve ham so.'),
          paragraph('a: Ham so lien tuc tren R.'),
          paragraph('b: Ham so dong bien tren khoang (0; +vo cuc).'),
          paragraph('c: Ham so co cuc tri tai x = 1.'),
          paragraph('d: Do thi cat truc tung tai y = 2.'),
          paragraph('DAP_AN_a: DUNG'),
          paragraph('DAP_AN_b: SAI'),
          paragraph('DAP_AN_c: DUNG'),
          paragraph('DAP_AN_d: SAI'),
          paragraph('LOI_GIAI_a: Mo ta ngan gon neu can.'),
          paragraph('GOI_Y_a:'),
          paragraph('CAU_TUONG_TU_a:'),
          paragraph('DAP_AN_TUONG_TU_a:'),
          paragraph('[PHAN_3]', { heading: HeadingLevel.HEADING_1, bold: true, color: '0F766E' }),
          paragraph('CAU 1:', { bold: true }),
          paragraph('NOI_DUNG: Tinh tong 12 + 15.'),
          paragraph('DAP_AN: 27'),
          paragraph('LOI_GIAI: Cong hai so nguyen duong theo thu tu.'),
          paragraph('GOI_Y:'),
          paragraph('CAU_TUONG_TU: Tinh 20 + 15.'),
          paragraph('DAP_AN_TUONG_TU: 35'),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'mau-import-de-thi-online.docx';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
