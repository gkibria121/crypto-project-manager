"use client";

import React, { useId } from "react";
import type { FieldError } from "react-hook-form";

interface FormErrorMessageProps {
  id: string;
  error?: FieldError;
}

export function FormErrorMessage({ id, error }: FormErrorMessageProps) {
  if (!error?.message) return null;
  return (
    <div
      id={id}
      role="alert"
      aria-live="polite"
      className="mt-1 flex items-center gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400"
    >
      <span aria-hidden="true">❌</span>
      <span>{error.message}</span>
    </div>
  );
}

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  srOnlyLabel?: boolean;
  required?: boolean;
  error?: FieldError;
  className?: string;
  children: (fieldA11yProps: {
    id: string;
    "aria-invalid": boolean;
    "aria-errormessage"?: string;
    "aria-describedby"?: string;
  }) => React.ReactNode;
}

export function FormField({
  label,
  htmlFor,
  srOnlyLabel = false,
  required = false,
  error,
  className = "",
  children,
}: FormFieldProps) {
  const generatedId = useId();
  const inputId = htmlFor ?? generatedId;
  const errorId = `${inputId}-error`;
  const hasError = Boolean(error?.message);

  return (
    <div className={className}>
      <label
        htmlFor={inputId}
        className={
          srOnlyLabel
            ? "sr-only"
            : "block text-xs font-semibold mb-1 text-[#65676b] dark:text-[#8696a0]"
        }
      >
        {label}
        {required && !srOnlyLabel ? (
          <span aria-hidden="true" className="text-rose-500 ml-0.5">
            *
          </span>
        ) : null}
      </label>

      {children({
        id: inputId,
        "aria-invalid": hasError,
        "aria-errormessage": hasError ? errorId : undefined,
        "aria-describedby": hasError ? errorId : undefined,
      })}

      <FormErrorMessage id={errorId} error={error} />
    </div>
  );
}
