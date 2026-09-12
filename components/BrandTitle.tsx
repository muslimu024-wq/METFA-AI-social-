import React from 'react';

export type BrandService =
  | 'Social'
  | 'AI'
  | 'Chat'
  | 'V2 Dashboard'
  | 'Verified'
  | 'Ads'
  | 'Revenue'
  | 'Contribution'
  | 'Rewards'
  | 'Risk'
  | 'Wallet'
  | 'Payout'
  | 'Operations AI'
  | 'Signal'
  | 'Work'
  | 'Freelancer/Team'
  | 'Creator'
  | 'Audio'
  | 'Admin Control'
  | 'Governance + Audit'
  | (string & {});

interface BrandTitleProps {
  service?: BrandService;
  size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl';
  theme?: 'light' | 'dark' | 'auto';
  className?: string;
  asHeading?: boolean;
}

const SIZE_MAP: Record<string, { metfa: string; service: string }> = {
  xs: {
    metfa: 'text-[11px]',
    service: 'text-[11px]',
  },
  sm: {
    metfa: 'text-xs sm:text-sm',
    service: 'text-xs sm:text-sm',
  },
  base: {
    metfa: 'text-base sm:text-lg',
    service: 'text-base sm:text-lg',
  },
  lg: {
    metfa: 'text-lg sm:text-xl',
    service: 'text-lg sm:text-xl',
  },
  xl: {
    metfa: 'text-2xl sm:text-3xl',
    service: 'text-2xl sm:text-3xl',
  },
  '2xl': {
    metfa: 'text-3xl sm:text-4xl',
    service: 'text-3xl sm:text-4xl',
  },
};

/**
 * BrandTitle component
 * Enforces METFA master brand typography:
 * - "METFA" as the stronger brand: uppercase, font-black (900), tight letter spacing
 * - Space between METFA and service name without dot separator or extra spacing
 * - Service name ("Social", "AI", or "Chat") styled using the existing active navigation accent color (purple-600)
 */
export const BrandTitle: React.FC<BrandTitleProps> = ({
  service = 'Social',
  size = 'base',
  theme = 'light',
  className = '',
  asHeading = false,
}) => {
  const isDark = theme === 'dark';
  const sizeClasses = SIZE_MAP[size] || SIZE_MAP.base;

  const content = (
    <span
      className={`inline-flex items-baseline select-none whitespace-nowrap leading-none gap-1 sm:gap-1.5 ${className}`}
    >
      <span
        className={`font-black tracking-tight ${sizeClasses.metfa} ${
          isDark ? 'text-white' : 'text-slate-900'
        }`}
      >
        METFA
      </span>
      <span
        className={`font-bold tracking-tight ${sizeClasses.service} ${
          isDark ? 'text-purple-400' : 'text-purple-600'
        }`}
      >
        {service}
      </span>
    </span>
  );

  if (asHeading) {
    return <h1 className="inline-flex items-baseline m-0 p-0 leading-none">{content}</h1>;
  }

  return content;
};

export default BrandTitle;
