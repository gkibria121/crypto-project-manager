"use client";

import React from "react";

interface FilterChipProps {
  active: boolean;
  onClick: () => void;
  count?: number;
  children: React.ReactNode;
  className?: string;
}

export function FilterChip({
  active,
  onClick,
  count,
  children,
  className = "",
}: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
        active
          ? "bg-[#e7f3ff] text-[#0084ff] dark:bg-[#0084ff]/20 dark:text-[#4599ff]"
          : "bg-[#f0f2f5] text-[#65676b] hover:bg-[#e4e6eb] dark:bg-[#202c33] dark:text-[#8696a0] dark:hover:bg-[#2a3942]"
      } ${className}`}
    >
      <span>{children}</span>
      {typeof count === "number" && count > 0 && (
        <span className="text-[11px] opacity-80">{count}</span>
      )}
    </button>
  );
}
