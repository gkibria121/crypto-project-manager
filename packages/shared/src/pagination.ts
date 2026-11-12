export const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export const COMPACT_PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100] as const;

export type PageNumberItem = number | "ellipsis";

export interface PaginationMeta {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface PaginatedResult<T> {
  items: T[];
  meta: PaginationMeta;
}

export function clampPage(page: number, totalPages: number): number {
  const safeTotal = Math.max(1, Math.floor(totalPages) || 1);
  if (!Number.isFinite(page) || page < 1) {
    return 1;
  }
  return Math.min(Math.floor(page), safeTotal);
}

export function calculatePaginationMeta(
  totalItems: number,
  page: number,
  pageSize: number
): PaginationMeta {
  const safeTotalItems = Math.max(0, Math.floor(totalItems) || 0);
  const safePageSize = Math.max(1, Math.floor(pageSize) || 10);
  const totalPages = Math.max(1, Math.ceil(safeTotalItems / safePageSize));
  const currentPage = clampPage(page, totalPages);

  const startIndex =
    safeTotalItems === 0 ? 0 : (currentPage - 1) * safePageSize;
  const endIndex =
    safeTotalItems === 0
      ? 0
      : Math.min(startIndex + safePageSize, safeTotalItems);

  return {
    currentPage,
    pageSize: safePageSize,
    totalItems: safeTotalItems,
    totalPages,
    startIndex,
    endIndex,
    hasPreviousPage: currentPage > 1,
    hasNextPage: currentPage < totalPages,
  };
}

export function paginateItems<T>(
  items: readonly T[],
  page: number,
  pageSize: number
): PaginatedResult<T> {
  const meta = calculatePaginationMeta(items.length, page, pageSize);
  const sliced =
    meta.totalItems === 0
      ? []
      : items.slice(meta.startIndex, meta.endIndex);

  return {
    items: sliced,
    meta,
  };
}

export function buildPaginationWindow(
  currentPage: number,
  totalPages: number,
  siblingCount = 1
): PageNumberItem[] {
  const safeTotal = Math.max(1, Math.floor(totalPages) || 1);
  const safeCurrent = clampPage(currentPage, safeTotal);
  const totalSlots = siblingCount * 2 + 5;

  if (safeTotal <= totalSlots) {
    return Array.from({ length: safeTotal }, (_, idx) => idx + 1);
  }

  const leftSibling = Math.max(safeCurrent - siblingCount, 1);
  const rightSibling = Math.min(safeCurrent + siblingCount, safeTotal);

  const showLeftEllipsis = leftSibling > 2;
  const showRightEllipsis = rightSibling < safeTotal - 1;

  if (!showLeftEllipsis && showRightEllipsis) {
    const leftCount = 3 + 2 * siblingCount;
    const leftRange = Array.from({ length: leftCount }, (_, idx) => idx + 1);
    return [...leftRange, "ellipsis", safeTotal];
  }

  if (showLeftEllipsis && !showRightEllipsis) {
    const rightCount = 3 + 2 * siblingCount;
    const start = safeTotal - rightCount + 1;
    const rightRange = Array.from(
      { length: rightCount },
      (_, idx) => start + idx
    );
    return [1, "ellipsis", ...rightRange];
  }

  const middleRange = Array.from(
    { length: rightSibling - leftSibling + 1 },
    (_, idx) => leftSibling + idx
  );
  return [1, "ellipsis", ...middleRange, "ellipsis", safeTotal];
}
