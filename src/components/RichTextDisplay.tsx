import React, { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface RichTextDisplayProps {
  html: string;
}

const CHEMICAL_EXPRESSION_REGEX = /(?:[A-Za-z][a-z]?(?:\d+)?(?:\([A-Za-z0-9+\-]+\)\d*)*(?:\^\{?[0-9]*[+-]\}?|[0-9]*[+-])?(?:\((?:aq|g|l|s)\))?)(?:\s*(?:\+|→|⇌|↔|⇄|<=>|<->|=>|=)\s*(?:[A-Za-z][a-z]?(?:\d+)?(?:\([A-Za-z0-9+\-]+\)\d*)*(?:\^\{?[0-9]*[+-]\}?|[0-9]*[+-])?(?:\((?:aq|g|l|s)\))?))*/g;
const DELIMITED_MATH_REGEX = /(\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$\$[\s\S]+?\$\$|\$[^$\n]+\$)/g;
const ELEMENT_SYMBOLS = new Set([
  'H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne', 'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar', 'K', 'Ca',
  'Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn', 'Ga', 'Ge', 'As', 'Se', 'Br', 'Kr', 'Rb', 'Sr',
  'Y', 'Zr', 'Nb', 'Mo', 'Tc', 'Ru', 'Rh', 'Pd', 'Ag', 'Cd', 'In', 'Sn', 'Sb', 'Te', 'I', 'Xe', 'Cs', 'Ba',
  'La', 'Ce', 'Pr', 'Nd', 'Pm', 'Sm', 'Eu', 'Gd', 'Tb', 'Dy', 'Ho', 'Er', 'Tm', 'Yb', 'Lu', 'Hf', 'Ta', 'W',
  'Re', 'Os', 'Ir', 'Pt', 'Au', 'Hg', 'Tl', 'Pb', 'Bi', 'Po', 'At', 'Rn', 'Fr', 'Ra', 'Ac', 'Th', 'Pa', 'U',
  'Np', 'Pu', 'Am', 'Cm', 'Bk', 'Cf', 'Es', 'Fm', 'Md', 'No', 'Lr', 'Rf', 'Db', 'Sg', 'Bh', 'Hs', 'Mt', 'Ds',
  'Rg', 'Cn', 'Nh', 'Fl', 'Mc', 'Lv', 'Ts', 'Og'
]);

function shouldSkipTextNode(node: Text) {
  const parentTag = node.parentElement?.tagName?.toLowerCase();
  return !node.textContent?.trim() || ['script', 'style', 'code', 'pre', 'textarea', 'sub', 'sup'].includes(parentTag || '');
}

function createKatexNode(document: Document, formula: string, displayMode: boolean) {
  const wrapper = document.createElement(displayMode ? 'div' : 'span');
  wrapper.className = displayMode ? 'math-block' : 'math-inline';

  try {
    katex.render(formula, wrapper, {
      throwOnError: false,
      displayMode,
    });
  } catch (error) {
    wrapper.textContent = formula;
    console.error('KaTeX rendering error:', error);
  }

  return wrapper;
}

function renderDelimitedMath(container: HTMLElement) {
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let currentNode = walker.nextNode();

  while (currentNode) {
    textNodes.push(currentNode as Text);
    currentNode = walker.nextNode();
  }

  textNodes.forEach((node) => {
    if (shouldSkipTextNode(node)) return;
    const text = node.textContent || '';
    if (!DELIMITED_MATH_REGEX.test(text)) return;
    DELIMITED_MATH_REGEX.lastIndex = 0;

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    for (const match of text.matchAll(DELIMITED_MATH_REGEX)) {
      const start = match.index ?? 0;
      if (start > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, start)));
      }

      const raw = match[0];
      const isBlock = raw.startsWith('\\[') || raw.startsWith('$$');
      const formula = raw
        .replace(/^\\\[/, '')
        .replace(/\\\]$/, '')
        .replace(/^\\\(/, '')
        .replace(/\\\)$/, '')
        .replace(/^\$\$/, '')
        .replace(/\$\$$/, '')
        .replace(/^\$/, '')
        .replace(/\$$/, '');

      fragment.appendChild(createKatexNode(document, formula, isBlock));
      lastIndex = start + raw.length;
    }

    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    node.parentNode?.replaceChild(fragment, node);
  });
}

function normalizeArrowToken(token: string) {
  return token
    .replace(/<=>|↔|⇄/g, '⇌')
    .replace(/<->|=>/g, '→');
}

function canonicalizeChemicalCore(core: string) {
  let i = 0;
  let result = '';

  while (i < core.length) {
    const ch = core[i];
    if (!/[A-Za-z]/.test(ch)) {
      result += ch;
      i += 1;
      continue;
    }

    const one = ch.toUpperCase();
    const twoCandidate = core.slice(i, i + 2);
    const two = twoCandidate.length === 2
      ? twoCandidate[0].toUpperCase() + twoCandidate[1].toLowerCase()
      : '';

    if (two && ELEMENT_SYMBOLS.has(two)) {
      result += two;
      i += 2;
      continue;
    }

    if (ELEMENT_SYMBOLS.has(one)) {
      result += one;
      i += 1;
      continue;
    }

    result += ch;
    i += 1;
  }

  return result;
}

function formatChemicalToken(token: string) {
  const trimmed = token.trim();
  if (!trimmed) return token;

  const stateMatch = trimmed.match(/(\((?:aq|g|l|s)\))$/i);
  const stateSuffix = stateMatch?.[1] || '';
  const withoutState = stateSuffix ? trimmed.slice(0, -stateSuffix.length) : trimmed;

  const chargeMatch = withoutState.match(/(\^?\{?[0-9]*[+-]\}?|[+-])$/);
  const chargeSuffix = chargeMatch?.[1] || '';
  const withoutCharge = chargeSuffix ? withoutState.slice(0, -chargeSuffix.length) : withoutState;

  const canonicalCore = canonicalizeChemicalCore(withoutCharge);
  const formattedCore = canonicalCore.replace(/([A-Za-z\)])(\d+)/g, '$1<sub>$2</sub>');
  const formattedCharge = chargeSuffix
    ? `<sup>${chargeSuffix.replace(/^\^/, '').replace(/[{}]/g, '')}</sup>`
    : '';
  const formattedState = stateSuffix ? `<span class="chem-state">${stateSuffix}</span>` : '';

  return `<span class="chem-token">${formattedCore}${formattedCharge}${formattedState}</span>`;
}

function formatChemicalExpression(expression: string) {
  const parts = normalizeArrowToken(expression).split(/(\s*(?:\+|→|⇌|=)\s*)/g);
  return parts
    .map((part) => {
      const normalized = part.trim();
      if (!normalized) return part;
      if (/^(?:\+|→|⇌|=)$/.test(normalized)) {
        return `<span class="chem-separator">${normalized}</span>`;
      }
      return formatChemicalToken(part);
    })
    .join('');
}

function renderChemicalText(container: HTMLElement) {
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let currentNode = walker.nextNode();

  while (currentNode) {
    textNodes.push(currentNode as Text);
    currentNode = walker.nextNode();
  }

  textNodes.forEach((node) => {
    if (shouldSkipTextNode(node)) return;
    const text = node.textContent || '';
    CHEMICAL_EXPRESSION_REGEX.lastIndex = 0;
    if (!CHEMICAL_EXPRESSION_REGEX.test(text)) return;
    CHEMICAL_EXPRESSION_REGEX.lastIndex = 0;

    const html = text.replace(CHEMICAL_EXPRESSION_REGEX, (match) => formatChemicalExpression(match));
    if (html === text) return;

    const wrapper = document.createElement('span');
    wrapper.innerHTML = html;
    node.parentNode?.replaceChild(wrapper, node);
  });
}

export const RichTextDisplay: React.FC<RichTextDisplayProps> = ({ html }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      const formulaElements = containerRef.current.querySelectorAll('.ql-formula');
      formulaElements.forEach((el) => {
        const formula = el.getAttribute('data-value');
        if (formula) {
          try {
            katex.render(formula, el as HTMLElement, {
              throwOnError: false,
              displayMode: false,
            });
          } catch (e) {
            console.error('KaTeX rendering error:', e);
          }
        }
      });

      renderDelimitedMath(containerRef.current);
      renderChemicalText(containerRef.current);
    }
  }, [html]);

  return (
    <div 
      ref={containerRef}
      className="ql-editor p-0 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:my-3 [&_img]:border [&_img]:border-slate-200 [&_.chem-token]:font-medium [&_.chem-token_sub]:text-[0.8em] [&_.chem-token_sup]:text-[0.8em] [&_.chem-state]:text-slate-500 [&_.chem-state]:ml-0.5 [&_.chem-separator]:mx-1 [&_.math-block]:my-3 [&_.math-inline]:inline-block"
      dangerouslySetInnerHTML={{ __html: html }} 
    />
  );
};
