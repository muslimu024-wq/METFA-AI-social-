import React, { useState } from 'react';
import { Copy, Check, Terminal } from 'lucide-react';

interface MarkdownMessageProps {
  content: string;
}

export const MarkdownMessage: React.FC<MarkdownMessageProps> = ({ content }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopyCode = (codeText: string, index: number) => {
    navigator.clipboard.writeText(codeText);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Safe and comprehensive markdown parser with clean book-reading typography
  const parseMarkdown = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeLanguage = '';
    let codeBuffer: string[] = [];
    let codeBlockCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('```')) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          codeLanguage = line.slice(3).trim() || 'code';
          codeBuffer = [];
        } else {
          inCodeBlock = false;
          const blockIndex = codeBlockCount++;
          const codeString = codeBuffer.join('\n');
          elements.push(
            <div key={`code-block-${blockIndex}`} className="my-3.5 rounded-2xl overflow-hidden border border-gray-200 bg-gray-950 shadow-md w-full max-w-full">
              <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 text-xs text-gray-400">
                <div className="flex items-center gap-2 font-mono">
                  <Terminal className="w-3.5 h-3.5 text-purple-400" />
                  <span className="text-gray-200 font-semibold">{codeLanguage}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyCode(codeString, blockIndex)}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 transition active:scale-95"
                >
                  {copiedIndex === blockIndex ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-teal-400" />
                      <span className="text-teal-300 font-medium">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-gray-400" />
                      <span>Copy code</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-4 overflow-x-auto text-xs sm:text-sm text-purple-200 font-mono leading-relaxed selection:bg-purple-800 scrollbar-thin">
                <code>{codeString}</code>
              </pre>
            </div>
          );
        }
        continue;
      }

      if (inCodeBlock) {
        codeBuffer.push(line);
        continue;
      }

      if (line.startsWith('### ')) {
        elements.push(
          <h3 key={`h3-${i}`} className="text-base sm:text-lg font-bold text-gray-900 mt-4 mb-2 flex items-center gap-2 tracking-tight">
            <span className="w-1.5 h-4 bg-purple-600 rounded-full inline-block shrink-0"></span>
            <span>{renderInlineMarkdown(line.slice(4))}</span>
          </h3>
        );
      } else if (line.startsWith('## ')) {
        elements.push(
          <h2 key={`h2-${i}`} className="text-lg sm:text-xl font-bold text-gray-900 mt-5 mb-2.5 tracking-tight border-b border-gray-200 pb-1.5">
            {renderInlineMarkdown(line.slice(3))}
          </h2>
        );
      } else if (line.startsWith('# ')) {
        elements.push(
          <h1 key={`h1-${i}`} className="text-xl sm:text-2xl font-extrabold text-gray-900 mt-6 mb-3 tracking-tight border-b border-gray-200 pb-2">
            {renderInlineMarkdown(line.slice(2))}
          </h1>
        );
      } else if (line.startsWith('> ')) {
        elements.push(
          <blockquote key={`quote-${i}`} className="border-l-4 border-purple-500 pl-4 py-2 my-3 bg-purple-50/80 text-purple-950 rounded-r-xl italic text-sm sm:text-base leading-relaxed break-words font-serif">
            {renderInlineMarkdown(line.slice(2))}
          </blockquote>
        );
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        elements.push(
          <li key={`li-${i}`} className="ml-5 list-disc text-sm sm:text-base text-gray-800 leading-relaxed sm:leading-7 my-1 pl-1 break-words">
            {renderInlineMarkdown(line.slice(2))}
          </li>
        );
      } else if (/^\d+\.\s/.test(line)) {
        const itemText = line.replace(/^\d+\.\s/, '');
        elements.push(
          <li key={`oli-${i}`} className="ml-5 list-decimal text-sm sm:text-base text-gray-800 leading-relaxed sm:leading-7 my-1 pl-1 break-words">
            {renderInlineMarkdown(itemText)}
          </li>
        );
      } else if (line.trim() === '') {
        elements.push(<div key={`blank-${i}`} className="h-2 sm:h-2.5" />);
      } else {
        elements.push(
          <p key={`p-${i}`} className="text-sm sm:text-base text-gray-800 leading-relaxed sm:leading-7 my-1.5 break-words">
            {renderInlineMarkdown(line)}
          </p>
        );
      }
    }

    return elements;
  };

  const renderInlineMarkdown = (raw: string) => {
    // Process bold **text**, *italic*, and inline `code`
    const parts = raw.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={index} className="font-bold text-gray-900">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
        return (
          <em key={index} className="italic text-purple-800">
            {part.slice(1, -1)}
          </em>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={index} className="px-1.5 py-0.5 bg-purple-50 border border-purple-200 text-purple-800 rounded-md font-mono text-xs sm:text-sm break-all font-semibold">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  return <div className="space-y-1 select-text w-full max-w-full text-left">{parseMarkdown(content)}</div>;
};

export default MarkdownMessage;
