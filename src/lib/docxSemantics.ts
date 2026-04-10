import JSZip from 'jszip';

export interface DocxSemanticSnapshot {
  documentXml: string;
  containsImages: boolean;
  containsMath: boolean;
  formulaHints: string[];
}

function decodeXmlEntities(input: string) {
  return input
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function cleanFormulaText(input: string) {
  return decodeXmlEntities(input)
    .replace(/\s+/g, ' ')
    .replace(/\u00A0/g, ' ')
    .trim();
}

function extractFormulaHints(documentXml: string) {
  const formulas: string[] = [];
  const regex = /<m:oMath(?:Para)?[\s\S]*?<\/m:oMath(?:Para)?>/g;
  const matches = documentXml.match(regex) || [];

  matches.forEach((block) => {
    const text = [...block.matchAll(/<m:t>([\s\S]*?)<\/m:t>/g)]
      .map((match) => cleanFormulaText(match[1] || ''))
      .filter(Boolean)
      .join(' ');

    if (text) {
      formulas.push(text);
    }
  });

  return formulas;
}

export async function inspectDocxSemantics(source: ArrayBuffer | Uint8Array | Buffer) {
  const zip = await JSZip.loadAsync(source as any);
  const documentXml = await zip.file('word/document.xml')?.async('string');
  const rawXml = documentXml || '';

  return {
    documentXml: rawXml,
    containsImages: /<w:drawing\b|<v:imagedata\b|<pic:pic\b/i.test(rawXml),
    containsMath: /<m:oMath\b|<m:oMathPara\b/i.test(rawXml),
    formulaHints: extractFormulaHints(rawXml),
  } satisfies DocxSemanticSnapshot;
}
