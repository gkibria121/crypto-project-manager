"use client";

import React, { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Clock,
  KeyRound,
  Lock,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import {
  loginDtoSchema,
  registerDtoSchema,
  type AuthRegisterResponse,
  type LoginDto,
  type RegisterDto,
  type SystemHealthStatus,
} from "@/types/project";

interface AuthScreenProps {
  onLogin: (values: LoginDto) => Promise<void>;
  onRegister: (values: RegisterDto) => Promise<AuthRegisterResponse | void>;
  healthStatus?: SystemHealthStatus;
  isSubmitting?: boolean;
  authError?: string | null;
}

export function AuthScreen({
  onLogin,
  onRegister,
  healthStatus,
  isSubmitting = false,
  authError = null,
}: AuthScreenProps) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [localError, setLocalError] = useState<string | null>(null);
  const [pendingApprovalNotice, setPendingApprovalNotice] = useState<{
    email: string;
    message: string;
  } | null>(null);

  const formHeadingId = useId();
  const signInEmailId = useId();
  const signInPasswordId = useId();
  const signUpNameId = useId();
  const signUpTitleId = useId();
  const signUpEmailId = useId();
  const signUpPasswordId = useId();
  const passwordConstraintsId = useId();
  const errorBannerId = useId();

  const signInForm = useForm<LoginDto>({
    resolver: zodResolver(loginDtoSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const signUpForm = useForm<RegisterDto>({
    resolver: zodResolver(registerDtoSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      name: "",
      email: "",
      password: "",
      title: "",
    },
  });

  const displayedError = localError ?? authError;

  const handleSignInSubmit = signInForm.handleSubmit(async (values) => {
    setLocalError(null);
    setPendingApprovalNotice(null);
    try {
      await onLogin(values);
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : "Failed to sign in."
      );
    }
  });

  const handleSignUpSubmit = signUpForm.handleSubmit(async (values) => {
    setLocalError(null);
    setPendingApprovalNotice(null);
    try {
      const response = await onRegister(values);
      signInForm.setValue("email", values.email.trim());
      signInForm.setValue("password", "");
      signUpForm.reset({
        name: "",
        email: "",
        password: "",
        title: "",
      });
      setPendingApprovalNotice({
        email: values.email.trim(),
        message:
          response && "message" in response
            ? response.message
            : "Account registered as inactive. A workspace administrator must activate your account before you can sign in.",
      });
      setMode("signin");
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : "Failed to create account."
      );
    }
  });

  return (
    <div className="min-h-dvh w-full overflow-y-auto scroller bg-[#f0f2f5] dark:bg-[#0b141a] text-[#050505] dark:text-[#e9edef] flex flex-col justify-center p-4 sm:p-6">
      <div className="max-w-md w-full mx-auto">
        <div className="rounded-2xl bg-white dark:bg-[#202c33] border border-[#e4e6eb] dark:border-[#2a3942] p-5 sm:p-7 shadow-sm flex flex-col justify-between">
          <div>
            {/* Brand & Service Status Header */}
            <div className="flex items-center justify-between gap-2 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#0084ff] text-white flex items-center justify-center font-bold shadow-xs">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-base font-bold tracking-tight block leading-tight">
                    PulseOS Workspace
                  </span>
                  <span className="text-[11px] text-[#65676b] dark:text-[#8696a0]">
                    RBAC Authenticated Web3 Command Center
                  </span>
                </div>
              </div>

              {healthStatus && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    healthStatus.status === "ok"
                      ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400"
                      : "bg-amber-500/12 text-amber-700 dark:text-amber-400"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      healthStatus.status === "ok"
                        ? "bg-[#00a884]"
                        : "bg-amber-500"
                    }`}
                  />
                  <span>
                    {healthStatus.status === "ok" ? "API Live" : "Degraded"}
                  </span>
                </span>
              )}
            </div>

            {/* Mode Switcher Tabs */}
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#f0f2f5] dark:bg-[#111b21] mb-5">
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setLocalError(null);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  mode === "signin"
                    ? "bg-white dark:bg-[#202c33] text-[#050505] dark:text-[#e9edef] shadow-2xs"
                    : "text-[#65676b] dark:text-[#8696a0] hover:text-[#050505] dark:hover:text-[#e9edef]"
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setLocalError(null);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  mode === "signup"
                    ? "bg-white dark:bg-[#202c33] text-[#050505] dark:text-[#e9edef] shadow-2xs"
                    : "text-[#65676b] dark:text-[#8696a0] hover:text-[#050505] dark:hover:text-[#e9edef]"
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Create Account</span>
              </button>
            </div>

            <h1 id={formHeadingId} className="text-lg font-bold mb-1">
              {mode === "signin"
                ? "Sign in to your account"
                : "Create a team account"}
            </h1>
            <p className="text-xs text-[#65676b] dark:text-[#8696a0] mb-4">
              {mode === "signin"
                ? "Enter your workspace email and password to continue."
                : "New accounts are created in an inactive state and require administrator activation before first sign-in."}
            </p>

            {/* Live Error & Pending Activation Announcement */}
            <div aria-live="polite" id={errorBannerId}>
              {pendingApprovalNotice && (
                <div
                  role="status"
                  className="mb-4 rounded-xl bg-amber-500/12 border border-amber-500/30 px-3.5 py-3 text-xs text-amber-800 dark:text-amber-300 space-y-1"
                >
                  <div className="flex items-center gap-1.5 font-bold">
                    <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>Account Pending Administrator Activation</span>
                  </div>
                  <p className="leading-relaxed">
                    <strong>{pendingApprovalNotice.email}</strong> has been
                    registered with status <strong>Inactive</strong>.{" "}
                    {pendingApprovalNotice.message}
                  </p>
                </div>
              )}

              {displayedError && (
                <div
                  role="alert"
                  className="mb-4 rounded-xl bg-rose-500/10 border border-rose-500/30 px-3.5 py-2.5 text-xs text-rose-700 dark:text-rose-300 font-medium"
                >
                  {displayedError}
                </div>
              )}
            </div>

            {mode === "signin" ? (
              <form
                method="post"
                aria-labelledby={formHeadingId}
                onSubmit={(e) => void handleSignInSubmit(e)}
                noValidate
                className="space-y-4"
              >
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor={signInEmailId}
                    className="text-xs font-semibold text-[#050505] dark:text-[#e9edef]"
                  >
                    Email address <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id={signInEmailId}
                    type="email"
                    autoComplete="username"
                    spellCheck={false}
                    enterKeyHint="next"
                    required
                    aria-invalid={Boolean(signInForm.formState.errors.email)}
                    {...signInForm.register("email", {
                      onChange: () => {
                        if (localError) setLocalError(null);
                      },
                    })}
                    placeholder="name@company.com"
                    className="w-full rounded-xl bg-[#f0f2f5] dark:bg-[#2a3942] px-3.5 py-2.5 text-base sm:text-sm text-[#050505] dark:text-[#e9edef] border border-transparent focus:border-[#0084ff] outline-none"
                  />
                  {signInForm.formState.errors.email && (
                    <span className="text-xs text-rose-600 dark:text-rose-400">
                      {signInForm.formState.errors.email.message}
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <label
                    htmlFor={signInPasswordId}
                    className="text-xs font-semibold text-[#050505] dark:text-[#e9edef]"
                  >
                    Password <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id={signInPasswordId}
                    type="password"
                    autoComplete="current-password"
                    enterKeyHint="done"
                    required
                    aria-invalid={Boolean(signInForm.formState.errors.password)}
                    {...signInForm.register("password", {
                      onChange: () => {
                        if (localError) setLocalError(null);
                      },
                    })}
                    className="w-full rounded-xl bg-[#f0f2f5] dark:bg-[#2a3942] px-3.5 py-2.5 text-base sm:text-sm text-[#050505] dark:text-[#e9edef] border border-transparent focus:border-[#0084ff] outline-none"
                  />
                  {signInForm.formState.errors.password && (
                    <span className="text-xs text-rose-600 dark:text-rose-400">
                      {signInForm.formState.errors.password.message}
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#0084ff] hover:bg-[#0073e6] disabled:opacity-50 text-white font-semibold text-sm transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <Lock className="w-4 h-4" />
                  <span>{isSubmitting ? "Signing in..." : "Sign in"}</span>
                </button>
              </form>
            ) : (
              <form
                method="post"
                aria-labelledby={formHeadingId}
                onSubmit={(e) => void handleSignUpSubmit(e)}
                noValidate
                className="space-y-3.5"
              >
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor={signUpNameId}
                    className="text-xs font-semibold text-[#050505] dark:text-[#e9edef]"
                  >
                    Full name <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id={signUpNameId}
                    type="text"
                    autoComplete="name"
                    enterKeyHint="next"
                    required
                    aria-invalid={Boolean(signUpForm.formState.errors.name)}
                    {...signUpForm.register("name", {
                      onChange: () => {
                        if (localError) setLocalError(null);
                      },
                    })}
                    placeholder="Jordan Taylor"
                    className="w-full rounded-xl bg-[#f0f2f5] dark:bg-[#2a3942] px-3.5 py-2.5 text-base sm:text-sm text-[#050505] dark:text-[#e9edef] border border-transparent focus:border-[#0084ff] outline-none"
                  />
                  {signUpForm.formState.errors.name && (
                    <span className="text-xs text-rose-600 dark:text-rose-400">
                      {signUpForm.formState.errors.name.message}
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <label
                    htmlFor={signUpEmailId}
                    className="text-xs font-semibold text-[#050505] dark:text-[#e9edef]"
                  >
                    Email address <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id={signUpEmailId}
                    type="email"
                    autoComplete="username"
                    spellCheck={false}
                    enterKeyHint="next"
                    required
                    aria-invalid={Boolean(signUpForm.formState.errors.email)}
                    {...signUpForm.register("email", {
                      onChange: () => {
                        if (localError) setLocalError(null);
                      },
                    })}
                    placeholder="name@company.com"
                    className="w-full rounded-xl bg-[#f0f2f5] dark:bg-[#2a3942] px-3.5 py-2.5 text-base sm:text-sm text-[#050505] dark:text-[#e9edef] border border-transparent focus:border-[#0084ff] outline-none"
                  />
                  {signUpForm.formState.errors.email && (
                    <span className="text-xs text-rose-600 dark:text-rose-400">
                      {signUpForm.formState.errors.email.message}
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <label
                    htmlFor={signUpTitleId}
                    className="text-xs font-semibold text-[#050505] dark:text-[#e9edef]"
                  >
                    Role title (optional)
                  </label>
                  <input
                    id={signUpTitleId}
                    type="text"
                    autoComplete="organization-title"
                    enterKeyHint="next"
                    {...signUpForm.register("title")}
                    placeholder="Ecosystem Strategist"
                    className="w-full rounded-xl bg-[#f0f2f5] dark:bg-[#2a3942] px-3.5 py-2.5 text-base sm:text-sm text-[#050505] dark:text-[#e9edef] border border-transparent focus:border-[#0084ff] outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label
                    htmlFor={signUpPasswordId}
                    className="text-xs font-semibold text-[#050505] dark:text-[#e9edef]"
                  >
                    Password <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id={signUpPasswordId}
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    enterKeyHint="done"
                    required
                    aria-describedby={passwordConstraintsId}
                    aria-invalid={Boolean(signUpForm.formState.errors.password)}
                    {...signUpForm.register("password", {
                      onChange: () => {
                        if (localError) setLocalError(null);
                      },
                    })}
                    className="w-full rounded-xl bg-[#f0f2f5] dark:bg-[#2a3942] px-3.5 py-2.5 text-base sm:text-sm text-[#050505] dark:text-[#e9edef] border border-transparent focus:border-[#0084ff] outline-none"
                  />
                  <span
                    id={passwordConstraintsId}
                    className="text-[11px] text-[#65676b] dark:text-[#8696a0]"
                  >
                    Eight or more characters.
                  </span>
                  {signUpForm.formState.errors.password && (
                    <span className="text-xs text-rose-600 dark:text-rose-400">
                      {signUpForm.formState.errors.password.message}
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#0084ff] hover:bg-[#0073e6] disabled:opacity-50 text-white font-semibold text-sm transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>
                    {isSubmitting ? "Creating account..." : "Create account"}
                  </span>
                </button>
              </form>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-[#e4e6eb] dark:border-[#2a3942] flex items-center justify-between text-[11px] text-[#65676b] dark:text-[#8696a0]">
            <span>HttpOnly Session Cookie + HS256 JWT</span>
            <span>scrypt (N=16384) KDF</span>
          </div>
        </div>
      </div>
    </div>
  );
}
