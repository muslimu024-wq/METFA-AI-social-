import React, { useState } from 'react';
import { Copy, Check, Terminal, Code2 } from 'lucide-react';

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

  // Simple and safe markdown parser for bold, headers, lists, and code blocks
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
            <div key={`code-block-${blockIndex}`} className="my-3 rounded-xl overflow-hidden border border-gray-800 bg-gray-950 shadow-md">
              <div className="flex items-center justify-between px-3.5 py-1.5 bg-gray-900 border-b border-gray-800 text-xs text-gray-400">
                <div className="flex items-center gap-1.5 font-mono">
                  <Terminal className="w-3.5 h-3.5 text-purple-400" />
                  <span className="text-gray-300 font-semibold">{codeLanguage}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyCode(codeString, blockIndex)}
                  className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 transition"
                >
                  {copiedIndex === blockIndex ? (
                    <>
                      <Check className="w-3 h-3 text-teal-400" />
                      <span className="text-teal-300">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-gray-400" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3.5 overflow-x-auto text-xs text-purple-200 font-mono leading-relaxed selection:bg-purple-800">
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
          <h3 key={`h3-${i}`} className="text-base font-bold text-white mt-3 mb-1.5 flex items-center gap-2">
            <span className="w-1.5 h-4 bg-purple-500 rounded-full inline-block"></span>
            {line.slice(4)}
          </h3>
        );
      } else if (line.startsWith('## ')) {
        elements.push(
          <h2 key={`h2-${i}`} className="text-lg font-extrabold text-white mt-4 mb-2">
            {line.slice(3)}
          </h2>
        );
      } else if (line.startsWith('# ')) {
        elements.push(
          <h1 key={`h1-${i}`} className="text-xl font-black text-white mt-4 mb-2">
            {line.slice(2)}
          </h1>
        );
      } else if (line.startsWith('> ')) {
        elements.push(
          <blockquote key={`quote-${i}`} className="border-l-4 border-purple-500 pl-3 py-1 my-2 bg-purple-950/20 text-purple-200 rounded-r-lg italic text-sm">
            {line.slice(2)}
          </blockquote>
        );
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        elements.push(
          <li key={`li-${i}`} className="ml-4 list-disc text-sm text-gray-200 leading-relaxed my-0.5">
            {renderInlineMarkdown(line.slice(2))}
          </li>
        );
      } else if (/^\d+\.\s/.test(line)) {
        const itemText = line.replace(/^\d+\.\s/, '');
        elements.push(
          <li key={`oli-${i}`} className="ml-4 list-decimal text-sm text-gray-200 leading-relaxed my-0.5">
            {renderInlineMarkdown(itemText)}
          </li>
        );
      } else if (line.trim() === '') {
        elements.push(<div key={`blank-${i}`} className="h-2" />);
      } else {
        elements.push(
          <p key={`p-${i}`} className="text-sm text-gray-200 leading-relaxed my-1">
            {renderInlineMarkdown(line)}
          </p>
        );
      }
    }

    return elements;
  };

  const renderInlineMarkdown = (raw: string) => {
    // Process bold **text** and inline `code`
    const parts = raw.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={index} className="font-bold text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={index} className="px-1.5 py-0.5 bg-gray-900 border border-gray-800 text-purple-300 rounded font-mono text-xs">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  return <div className="space-y-0.5 select-text">{parseMarkdown(content)}</div>;
};

export default MarkdownMessage;
