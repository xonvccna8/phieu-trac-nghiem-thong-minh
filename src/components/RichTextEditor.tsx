import React, { useMemo, useRef, useEffect, useState } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// Make katex globally available for Quill's formula module
(window as any).katex = katex;

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, placeholder, className = "h-48 mb-12" }) => {
  const quillRef = useRef<ReactQuill>(null);
  const [arrowModal, setArrowModal] = useState<{ isOpen: boolean, type: 'right' | 'both', index: number } | null>(null);
  const [topCondition, setTopCondition] = useState('');
  const [bottomCondition, setBottomCondition] = useState('');

  const arrowActionRef = useRef<any>(null);
  arrowActionRef.current = {
    open: (type: 'right' | 'both', quill: any) => {
      const index = quill.getSelection()?.index || 0;
      setArrowModal({ isOpen: true, type, index });
      setTopCondition('');
      setBottomCondition('');
    }
  };

  const modules = useMemo(() => ({
    toolbar: {
      container: [
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'script': 'sub'}, { 'script': 'super' }],
        ['formula'],
        ['clean'],
        ['arrowRight', 'arrowBoth']
      ],
      handlers: {
        arrowRight: function(this: any) {
          arrowActionRef.current?.open('right', this.quill);
        },
        arrowBoth: function(this: any) {
          arrowActionRef.current?.open('both', this.quill);
        }
      }
    }
  }), []);

  useEffect(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    const handleTextChange = (delta: any, oldDelta: any, source: string) => {
      if (source !== 'user') return;

      let currentIndex = 0;
      let shouldRestoreFormat = false;

      delta.ops.forEach((op: any) => {
        if (op.retain) {
          currentIndex += op.retain;
        } else if (op.insert) {
          if (typeof op.insert === 'string') {
            const insertedText = op.insert;
            
            // Handle single character typing
            if (insertedText.length === 1 && /^[0-9]$/.test(insertedText)) {
              if (currentIndex > 0) {
                const prevChar = quill.getText(currentIndex - 1, 1);
                const prevFormat = quill.getFormat(currentIndex - 1, 1);
                
                // Auto-subscript if previous char is a letter, closing bracket, or already a subscripted number
                if (/[a-zA-Z)\]]/.test(prevChar) || (/[0-9]/.test(prevChar) && prevFormat.script === 'sub')) {
                  quill.formatText(currentIndex, 1, 'script', 'sub', 'api');
                  shouldRestoreFormat = true;
                }
              }
            } 
            // Handle pasted text (e.g. "H2SO4")
            else if (insertedText.length > 1) {
              const regex = /([a-zA-Z)\]])([0-9]+)/g;
              let match;
              while ((match = regex.exec(insertedText)) !== null) {
                const letter = match[1];
                const numbers = match[2];
                const matchIndex = match.index;
                quill.formatText(currentIndex + matchIndex + letter.length, numbers.length, 'script', 'sub', 'api');
                
                if (matchIndex + letter.length + numbers.length === insertedText.length) {
                  shouldRestoreFormat = true;
                }
              }
            }
            currentIndex += insertedText.length;
          } else {
            // Insert can be an object like { image: '...' } or { formula: '...' }
            currentIndex += 1;
          }
        } else if (op.delete) {
          // Do nothing to currentIndex
        }
      });

      if (shouldRestoreFormat) {
        const selection = quill.getSelection();
        if (selection) {
          quill.format('script', false, 'api');
        }
      }
    };

    quill.on('text-change', handleTextChange);
    return () => {
      quill.off('text-change', handleTextChange);
    };
  }, []);

  const formatCondition = (text: string) => {
    if (!text) return '';
    
    let processed = text
      .replace(/([0-9]+)\s*oC/g, '$1^\\circ C')
      .replace(/([0-9]+)\s*\^oC/g, '$1^\\circ C')
      .replace(/([0-9]+)\s*°C/g, '$1^\\circ C')
      .replace(/t\^o/g, 't^\\circ')
      .replace(/t°/g, 't^\\circ')
      .replace(/\bto\b/g, 't^\\circ');

    const parts = processed.split(/(t\^\\circ|[0-9]+\^\\circ C)/);
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        return part;
      }
      if (part === '') return '';
      return `\\text{${part}}`;
    }).join('');
  };

  const insertArrow = () => {
    if (!arrowModal) return;
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    let formula = '';
    const top = formatCondition(topCondition.trim());
    const bottom = formatCondition(bottomCondition.trim());

    if (arrowModal.type === 'right') {
      if (bottom) {
        formula = `\\xrightarrow[${bottom}]{${top}}`;
      } else if (top) {
        formula = `\\xrightarrow{${top}}`;
      } else {
        formula = `\\rightarrow`;
      }
    } else {
      if (bottom) {
        formula = `\\xrightleftharpoons[${bottom}]{${top}}`;
      } else if (top) {
        formula = `\\xrightleftharpoons{${top}}`;
      } else {
        formula = `\\rightleftharpoons`;
      }
    }

    quill.insertEmbed(arrowModal.index, 'formula', formula);
    quill.insertText(arrowModal.index + 1, ' ');
    quill.setSelection(arrowModal.index + 2, 0);
    setArrowModal(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      insertArrow();
    } else if (e.key === 'Escape') {
      setArrowModal(null);
    }
  };

  return (
    <div className="bg-white rounded-md border border-gray-200 relative">
      <style>{`
        .ql-arrowRight::after {
          content: "→";
          font-size: 16px;
          line-height: 1;
        }
        .ql-arrowBoth::after {
          content: "⇌";
          font-size: 16px;
          line-height: 1;
        }
      `}</style>
      <ReactQuill 
        ref={quillRef}
        theme="snow" 
        value={value} 
        onChange={onChange} 
        modules={modules}
        placeholder={placeholder}
        className={className}
      />

      {arrowModal?.isOpen && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 bg-white p-4 rounded-lg shadow-xl border border-gray-200 w-80">
          <h3 className="font-bold text-gray-800 mb-3">
            Chèn mũi tên {arrowModal.type === 'right' ? '1 chiều' : '2 chiều'}
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Điều kiện trên (VD: t°, xt)</label>
              <input
                type="text"
                value={topCondition}
                onChange={e => setTopCondition(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                placeholder="Để trống nếu không có"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Điều kiện dưới (Tùy chọn)</label>
              <input
                type="text"
                value={bottomCondition}
                onChange={e => setBottomCondition(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                placeholder="Để trống nếu không có"
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setArrowModal(null)}
                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
              >
                Hủy
              </button>
              <button
                onClick={insertArrow}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded"
              >
                Chèn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
