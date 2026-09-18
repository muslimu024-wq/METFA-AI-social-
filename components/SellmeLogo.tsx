import React, { useState } from 'react';

interface SellmeLogoProps {
  className?: string;
  size?: number | string;
  rounded?: boolean;
  alt?: string;
}

export const SellmeLogo: React.FC<SellmeLogoProps> = ({
  className = 'w-5 h-5',
  size,
  rounded = true,
  alt = 'Sellme App',
}) => {
  const [retryIndex, setRetryIndex] = useState(0);

  const styleObj: React.CSSProperties = {};
  if (typeof size === 'number') {
    styleObj.width = `${size}px`;
    styleObj.height = `${size}px`;
  } else if (typeof size === 'string') {
    styleObj.width = size;
    styleObj.height = size;
  }

  const roundedClass = rounded ? 'rounded-md' : '';

  const sources = [
    '/File_00000000b1ac81f4b289aa88bf40cbb8.png',
    '/file_00000000b1ac81f4b289aa88bf40cbb8.png',
    '/sellme-app-logo.png',
    '/sellme-logo.png',
  ];

  const currentSrc = sources[retryIndex] || sources[0];

  return (
    <img
      src={currentSrc}
      alt={alt}
      onError={() => {
        if (retryIndex < sources.length - 1) {
          setRetryIndex(prev => prev + 1);
        }
      }}
      className={`object-contain shrink-0 ${roundedClass} ${className}`}
      style={size ? styleObj : undefined}
      loading="eager"
      decoding="async"
    />
  );
};

export default SellmeLogo;

