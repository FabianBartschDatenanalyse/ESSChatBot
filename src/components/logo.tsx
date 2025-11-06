import * as React from 'react';
import { cn } from '@/src/lib/utils';

type LogoProps = {
  className?: string;
  style?: React.CSSProperties;
};

const Logo = ({ className, style }: LogoProps) => (
  <div className={cn('flex items-center gap-3', className)} style={style}>
    <svg
      role="img"
      aria-hidden="true"
      viewBox="0 0 48 48"
      className="h-10 w-10 drop-shadow-[0_12px_24px_rgba(140,115,255,0.25)]"
    >
      <defs>
        <linearGradient id="socialanalysis-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#0EA5E9" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="40" height="40" rx="12" fill="url(#socialanalysis-gradient)" />
      <g fill="#0F172A" opacity="0.16">
        <path d="M8 32c8.5-5.5 23.5-7 32-6v10H8z" />
      </g>
      <g fill="#F8FAFC">
        <rect x="14" y="20" width="4" height="12" rx="2" />
        <rect x="22" y="14" width="4" height="18" rx="2" />
        <rect x="30" y="10" width="4" height="22" rx="2" />
      </g>
    </svg>
    <span className="font-heading text-lg font-semibold tracking-tight text-foreground">
      Social<span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Analysis</span>
    </span>
  </div>
);

export default Logo;
