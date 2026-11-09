"use client";

import { useCallback, useRef, type CompositionEvent, type KeyboardEvent } from "react";

export function useImeSafeSubmit(onSubmitTrigger: () => void) {
  const lastCompositionEndAtRef = useRef<number | null>(null);

  const onCompositionEnd = useCallback(
    (e: CompositionEvent<HTMLTextAreaElement>) => {
      lastCompositionEndAtRef.current = e.timeStamp;
    },
    []
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();

        if (e.nativeEvent.isComposing || e.keyCode === 229) {
          return;
        }

        if (
          lastCompositionEndAtRef.current !== null &&
          Math.abs(e.timeStamp - lastCompositionEndAtRef.current) < 50
        ) {
          return;
        }

        onSubmitTrigger();
      }
    },
    [onSubmitTrigger]
  );

  return { onCompositionEnd, onKeyDown };
}
