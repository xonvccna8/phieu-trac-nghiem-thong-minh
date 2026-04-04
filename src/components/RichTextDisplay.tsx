import React, { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface RichTextDisplayProps {
  html: string;
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
    }
  }, [html]);

  return (
    <div 
      ref={containerRef}
      className="ql-editor p-0"
      dangerouslySetInnerHTML={{ __html: html }} 
    />
  );
};
