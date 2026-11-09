"use client";

import React, { useId, type RefObject } from "react";
import { X } from "lucide-react";
import { useDialogLightDismiss } from "@/hooks/useDialogLightDismiss";

interface ModalDialogProps {
  dialogRef: RefObject<HTMLDialogElement | null>;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  maxWidthClass?: string;
  children: React.ReactNode;
}

export function ModalDialog({
  dialogRef,
  title,
  subtitle,
  maxWidthClass = "max-w-md",
  children,
}: ModalDialogProps) {
  const titleId = useId();
  useDialogLightDismiss(dialogRef);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...({ closedby: "any" } as React.DialogHTMLAttributes<HTMLDialogElement>)}
      className={`m-auto w-full ${maxWidthClass} rounded-2xl bg-white dark:bg-[#202c33] text-[#050505] dark:text-[#e9edef] border border-[#e4e6eb] dark:border-[#2a3942] p-0 shadow-xl`}
    >
      <div className="p-5">
        <div className="flex items-center justify-between pb-3 border-b border-[#e4e6eb] dark:border-[#2a3942]">
          <div>
            <h2 id={titleId} className="text-base font-bold">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-[#65676b] dark:text-[#8696a0]">
                {subtitle}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Close dialog"
            className="w-8 h-8 rounded-full text-[#65676b] dark:text-[#8696a0] hover:bg-[#f0f2f5] dark:hover:bg-[#2a3942] flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {children}
      </div>
    </dialog>
  );
}
