"use client";

import { useCallback, useMemo, useState } from "react";
import {
  DEFAULT_PAGE_SIZE_OPTIONS,
  buildPaginationWindow,
  calculatePaginationMeta,
  clampPage,
  paginateItems,
  type PageNumberItem,
  type PaginationMeta,
} from "@/types/project";

export interface UsePaginationOptions {
  initialPage?: number;
  initialPageSize?: number;
  pageSizeOptions?: readonly number[];
  resetKey?: string;
  siblingCount?: number;
  initialPageStrategy?: "first" | "last";
}

export interface UsePaginationReturn<T> {
  items: T[];
  meta: PaginationMeta;
  pageNumbers: PageNumberItem[];
  pageSizeOptions: readonly number[];
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  goToFirstPage: () => void;
  goToPreviousPage: () => void;
  goToNextPage: () => void;
  goToLastPage: () => void;
}

export function usePagination<T>(
  sourceItems: readonly T[],
  options: UsePaginationOptions = {}
): UsePaginationReturn<T> {
  const {
    initialPage = 1,
    initialPageSize = 10,
    pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
    resetKey = "",
    siblingCount = 1,
    initialPageStrategy = "first",
  } = options;

  const [pageSize, setPageSizeState] = useState<number>(initialPageSize);

  const [pageState, setPageState] = useState<{
    mode: "first" | "last" | "pinned";
    page: number;
    key: string;
  }>({
    mode:
      initialPageStrategy === "last"
        ? "last"
        : initialPage > 1
          ? "pinned"
          : "first",
    page: initialPage,
    key: resetKey,
  });

  const activeMetaPreview = useMemo(
    () => calculatePaginationMeta(sourceItems.length, 1, pageSize),
    [sourceItems.length, pageSize]
  );

  const effectiveMode =
    pageState.key === resetKey
      ? pageState.mode
      : initialPageStrategy === "last"
        ? "last"
        : "first";

  const requestedPage =
    effectiveMode === "last"
      ? activeMetaPreview.totalPages
      : effectiveMode === "pinned" && pageState.key === resetKey
        ? pageState.page
        : 1;

  const { items, meta } = useMemo(
    () => paginateItems(sourceItems, requestedPage, pageSize),
    [sourceItems, requestedPage, pageSize]
  );

  const pageNumbers = useMemo(
    () =>
      buildPaginationWindow(meta.currentPage, meta.totalPages, siblingCount),
    [meta.currentPage, meta.totalPages, siblingCount]
  );

  const setPage = useCallback(
    (nextPage: number) => {
      const clamped = clampPage(nextPage, meta.totalPages);
      const isFollowingTail =
        initialPageStrategy === "last" && clamped >= meta.totalPages;
      setPageState({
        mode: isFollowingTail ? "last" : "pinned",
        page: clamped,
        key: resetKey,
      });
    },
    [initialPageStrategy, meta.totalPages, resetKey]
  );

  const setPageSize = useCallback(
    (nextSize: number) => {
      const safeSize = Math.max(1, Math.floor(nextSize) || initialPageSize);
      setPageSizeState(safeSize);
      setPageState({
        mode: initialPageStrategy === "last" ? "last" : "first",
        page: 1,
        key: resetKey,
      });
    },
    [initialPageSize, initialPageStrategy, resetKey]
  );

  const goToFirstPage = useCallback(() => {
    setPage(1);
  }, [setPage]);

  const goToPreviousPage = useCallback(() => {
    setPage(meta.currentPage - 1);
  }, [meta.currentPage, setPage]);

  const goToNextPage = useCallback(() => {
    setPage(meta.currentPage + 1);
  }, [meta.currentPage, setPage]);

  const goToLastPage = useCallback(() => {
    setPage(meta.totalPages);
  }, [meta.totalPages, setPage]);

  return {
    items,
    meta,
    pageNumbers,
    pageSizeOptions,
    setPage,
    setPageSize,
    goToFirstPage,
    goToPreviousPage,
    goToNextPage,
    goToLastPage,
  };
}
