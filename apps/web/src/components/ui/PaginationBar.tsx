"use client";

import React, { useId } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import type { PageNumberItem, PaginationMeta } from "@/types/project";

export interface PaginationBarProps {
  meta: PaginationMeta;
  pageNumbers?: PageNumberItem[];
  pageSizeOptions?: readonly number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  itemLabel?: string;
  ariaLabel?: string;
  variant?: "default" | "compact";
  hideWhenSinglePage?: boolean;
  className?: string;
}

export function PaginationBar({
  meta,
  pageNumbers = [],
  pageSizeOptions = [10, 25, 50, 100],
  onPageChange,
  onPageSizeChange,
  itemLabel = "items",
  ariaLabel = "Pagination",
  variant = "default",
  hideWhenSinglePage = false,
  className = "",
}: PaginationBarProps) {
  const pageSizeSelectId = useId();

  if (meta.totalItems === 0) {
    return null;
  }

  if (hideWhenSinglePage && meta.totalPages <= 1) {
    return null;
  }

  const displayStart = meta.startIndex + 1;
  const displayEnd = meta.endIndex;

  if (variant === "compact") {
    return (
      <nav
        aria-label={ariaLabel}
        className={`flex items-center justify-between gap-2 pt-2 text-[11px] text-[#65676b] dark:text-[#8696a0] flex-wrap ${className}`}
      >
        <div className="flex items-center gap-2">
          <span>
            <strong className="font-semibold text-[#050505] dark:text-[#e9edef]">
              {displayStart}–{displayEnd}
            </strong>{" "}
            of{" "}
            <strong className="font-semibold text-[#050505] dark:text-[#e9edef]">
              {meta.totalItems}
            </strong>{" "}
            {itemLabel}
          </span>

          {onPageSizeChange && pageSizeOptions.length > 1 && (
            <div className="inline-flex items-center gap-1">
              <label htmlFor={pageSizeSelectId} className="visually-hidden">
                {itemLabel} per page
              </label>
              <select
                id={pageSizeSelectId}
                value={meta.pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                className="rounded-lg bg-[#f0f2f5] dark:bg-[#202c33] border border-[#e4e6eb] dark:border-[#2a3942] px-1.5 py-0.5 text-[11px] font-semibold text-[#050505] dark:text-[#e9edef] outline-none cursor-pointer"
              >
                {pageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size} / page
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {meta.totalPages > 1 && (
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              disabled={!meta.hasPreviousPage}
              onClick={() => onPageChange(meta.currentPage - 1)}
              aria-label="Previous page"
              className="min-w-6 min-h-6 p-1 rounded-lg bg-[#f0f2f5] hover:bg-[#e4e6eb] dark:bg-[#202c33] dark:hover:bg-[#2a3942] text-[#050505] dark:text-[#e9edef] disabled:opacity-40 disabled:pointer-events-none inline-flex items-center justify-center transition cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
            </button>

            <span className="px-1.5 font-mono text-[11px] font-semibold text-[#050505] dark:text-[#e9edef]">
              {meta.currentPage} / {meta.totalPages}
            </span>

            <button
              type="button"
              disabled={!meta.hasNextPage}
              onClick={() => onPageChange(meta.currentPage + 1)}
              aria-label="Next page"
              className="min-w-6 min-h-6 p-1 rounded-lg bg-[#f0f2f5] hover:bg-[#e4e6eb] dark:bg-[#202c33] dark:hover:bg-[#2a3942] text-[#050505] dark:text-[#e9edef] disabled:opacity-40 disabled:pointer-events-none inline-flex items-center justify-center transition cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
      </nav>
    );
  }

  return (
    <nav
      aria-label={ariaLabel}
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 text-xs text-[#65676b] dark:text-[#8696a0] ${className}`}
    >
      <div className="flex items-center gap-3 flex-wrap">
        <span>
          Showing{" "}
          <strong className="font-semibold text-[#050505] dark:text-[#e9edef]">
            {displayStart}–{displayEnd}
          </strong>{" "}
          of{" "}
          <strong className="font-semibold text-[#050505] dark:text-[#e9edef]">
            {meta.totalItems}
          </strong>{" "}
          {itemLabel}
        </span>

        {onPageSizeChange && pageSizeOptions.length > 1 && (
          <div className="inline-flex items-center gap-1.5">
            <label
              htmlFor={pageSizeSelectId}
              className="text-[11px] text-[#65676b] dark:text-[#8696a0]"
            >
              Rows per page
            </label>
            <select
              id={pageSizeSelectId}
              value={meta.pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded-lg bg-[#f0f2f5] dark:bg-[#111b21] border border-[#e4e6eb] dark:border-[#2a3942] px-2 py-1 text-xs font-semibold text-[#050505] dark:text-[#e9edef] outline-none cursor-pointer"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {meta.totalPages > 1 && (
        <div className="inline-flex items-center gap-1 flex-wrap">
          <button
            type="button"
            disabled={!meta.hasPreviousPage}
            onClick={() => onPageChange(1)}
            aria-label="First page"
            className="min-w-7 min-h-7 p-1.5 rounded-lg bg-[#f0f2f5] hover:bg-[#e4e6eb] dark:bg-[#111b21] dark:hover:bg-[#2a3942] text-[#050505] dark:text-[#e9edef] disabled:opacity-40 disabled:pointer-events-none inline-flex items-center justify-center transition cursor-pointer"
          >
            <ChevronsLeft className="w-3.5 h-3.5" aria-hidden="true" />
          </button>

          <button
            type="button"
            disabled={!meta.hasPreviousPage}
            onClick={() => onPageChange(meta.currentPage - 1)}
            aria-label="Previous page"
            className="min-w-7 min-h-7 px-2 py-1 rounded-lg bg-[#f0f2f5] hover:bg-[#e4e6eb] dark:bg-[#111b21] dark:hover:bg-[#2a3942] text-[#050505] dark:text-[#e9edef] font-semibold disabled:opacity-40 disabled:pointer-events-none inline-flex items-center gap-1 transition cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden xs:inline">Prev</span>
          </button>

          {pageNumbers.map((item, idx) =>
            item === "ellipsis" ? (
              <span
                key={`ellipsis-${idx}`}
                aria-hidden="true"
                className="px-1.5 text-xs text-[#65676b] dark:text-[#8696a0] select-none"
              >
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                aria-current={item === meta.currentPage ? "page" : undefined}
                aria-label={`Page ${item}`}
                className={`min-w-7 min-h-7 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  item === meta.currentPage
                    ? "bg-[#0084ff] text-white"
                    : "bg-[#f0f2f5] hover:bg-[#e4e6eb] dark:bg-[#111b21] dark:hover:bg-[#2a3942] text-[#050505] dark:text-[#e9edef]"
                }`}
              >
                {item}
              </button>
            )
          )}

          <button
            type="button"
            disabled={!meta.hasNextPage}
            onClick={() => onPageChange(meta.currentPage + 1)}
            aria-label="Next page"
            className="min-w-7 min-h-7 px-2 py-1 rounded-lg bg-[#f0f2f5] hover:bg-[#e4e6eb] dark:bg-[#111b21] dark:hover:bg-[#2a3942] text-[#050505] dark:text-[#e9edef] font-semibold disabled:opacity-40 disabled:pointer-events-none inline-flex items-center gap-1 transition cursor-pointer"
          >
            <span className="hidden xs:inline">Next</span>
            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>

          <button
            type="button"
            disabled={!meta.hasNextPage}
            onClick={() => onPageChange(meta.totalPages)}
            aria-label="Last page"
            className="min-w-7 min-h-7 p-1.5 rounded-lg bg-[#f0f2f5] hover:bg-[#e4e6eb] dark:bg-[#111b21] dark:hover:bg-[#2a3942] text-[#050505] dark:text-[#e9edef] disabled:opacity-40 disabled:pointer-events-none inline-flex items-center justify-center transition cursor-pointer"
          >
            <ChevronsRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      )}
    </nav>
  );
}
