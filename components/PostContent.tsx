import React, { useState } from 'react';

export interface PostContentProps {
  text: string;
  charLimit?: number;
  className?: string;
  textClassName?: string;
  buttonClassName?: string;
}

export const PostContent: React.FC<PostContentProps> = ({
  text,
  charLimit = 180,
  className = '',
  textClassName = '',
  buttonClassName = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!text) return null;

  // Determine if text exceeds character limit or contains more than 3 line breaks
  const lineCount = (text.match(/\n/g) || []).length + 1;
  const isLongText = text.length > charLimit || lineCount > 3;

  const displayedText = isExpanded || !isLongText 
    ? text 
    : `${text.slice(0, charLimit).trim()}...`;

  return (
    <div className={`post-content ${className}`.trim()}>
      <p className={`text-gray-200 whitespace-pre-wrap ${!isExpanded && isLongText ? 'post-text' : ''} ${textClassName}`.trim()}>
        {displayedText}
      </p>

      {/* যদি লেখা বড় হয় তবেই 'See More' বাটন দেখাবে */}
      {isLongText && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className={`text-blue-400 hover:text-blue-300 font-semibold text-sm mt-1 focus:outline-none hover:underline inline-block cursor-pointer transition ${buttonClassName}`.trim()}
        >
          {isExpanded ? 'See Less' : 'See More'}
        </button>
      )}
    </div>
  );
};

export default PostContent;
