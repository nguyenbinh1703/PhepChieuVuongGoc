/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { ReactNode } from 'react';

interface Props {
  shortcut: string;
  position?: 'top' | 'bottom';
  children: ReactNode;
  className?: string;
}

export const LabTooltip: React.FC<Props> = ({
  shortcut,
  position = 'top',
  children,
  className = '',
}) => {
  const isBottom = position === 'bottom';

  return (
    <div className={`relative group inline-flex items-center justify-center ${className}`}>
      {children}
      <div
        role="tooltip"
        className={`absolute ${
          isBottom
            ? 'top-full mt-2 left-1/2 -translate-x-1/2'
            : 'bottom-full mb-2 left-1/2 -translate-x-1/2'
        } z-50 pointer-events-none select-none opacity-0 scale-90 translate-y-1 group-hover:opacity-100 group-hover:scale-100 group-hover:translate-y-0 transition-all duration-150 ease-out`}
      >
        <div className="relative px-2 py-0.5 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-md shadow-lg shadow-black/25 whitespace-nowrap flex items-center justify-center">
          <span className="font-mono text-[11px] font-bold text-sky-300 tracking-wider leading-none">
            {shortcut}
          </span>
          {/* Subtle Caret pointing to anchor */}
          <div
            className={`absolute left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-slate-900 border-slate-700/80 rotate-45 ${
              isBottom
                ? '-top-1 border-t border-l'
                : '-bottom-1 border-b border-r'
            }`}
          />
        </div>
      </div>
    </div>
  );
};
