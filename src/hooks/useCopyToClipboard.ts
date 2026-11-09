"use client";

import { useCallback, useRef, useState } from "react";

export function useCopyToClipboard(resetDelayMs = 1800) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback(
    async (id: string, text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopiedId(id);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          setCopiedId(null);
        }, resetDelayMs);
      } catch {
        // Ignore clipboard errors in restricted contexts
      }
    },
    [resetDelayMs]
  );

  return { copiedId, copy };
}
