"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Building2,
  CheckCircle2,
  Globe,
  MapPin,
  Save,
  UserCheck,
} from "lucide-react";
import {
  type AgencyProfile,
  type UpdateAgencyProfileDto,
} from "@/types/project";
import { FormField } from "@/components/ui";

const agencyFormSchema = z.object({
  companyName: z.string().trim().max(200),
  tagline: z.string().trim().max(300),
  aboutUs: z.string().trim().max(4000),
  services: z.string().trim().max(2000),
  website: z.string().trim().max(500),
  email: z
    .string()
    .trim()
    .max(200)
    .refine(
      (v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      "Please enter a valid company email address"
    ),
  phone: z.string().trim().max(80),
  address: z.string().trim().max(500),
  city: z.string().trim().max(120),
  country: z.string().trim().max(120),
  representativeName: z.string().trim().max(200),
  representativeTitle: z.string().trim().max(200),
  representativeEmail: z
    .string()
    .trim()
    .max(200)
    .refine(
      (v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      "Please enter a valid representative email address"
    ),
  representativePhone: z.string().trim().max(80),
  socialLinks: z.object({
    linkedin: z.string().trim().max(500),
    x: z.string().trim().max(500),
    telegram: z.string().trim().max(500),
    discord: z.string().trim().max(500),
  }),
  notes: z.string().trim().max(4000),
});

interface AgencyAboutUsPanelProps {
  profile?: AgencyProfile;
  canEdit: boolean;
  onSaveProfile: (dto: UpdateAgencyProfileDto) => Promise<unknown>;
}

function toFormValues(profile?: AgencyProfile): UpdateAgencyProfileDto {
  return {
    companyName: profile?.companyName ?? "",
    tagline: profile?.tagline ?? "",
    aboutUs: profile?.aboutUs ?? "",
    services: profile?.services ?? "",
    website: profile?.website ?? "",
    email: profile?.email ?? "",
    phone: profile?.phone ?? "",
    address: profile?.address ?? "",
    city: profile?.city ?? "",
    country: profile?.country ?? "",
    representativeName: profile?.representativeName ?? "",
    representativeTitle: profile?.representativeTitle ?? "",
    representativeEmail: profile?.representativeEmail ?? "",
    representativePhone: profile?.representativePhone ?? "",
    socialLinks: {
      linkedin: profile?.socialLinks?.linkedin ?? "",
      x: profile?.socialLinks?.x ?? "",
      telegram: profile?.socialLinks?.telegram ?? "",
      discord: profile?.socialLinks?.discord ?? "",
    },
    notes: profile?.notes ?? "",
  };
}

export function AgencyAboutUsPanel({
  profile,
  canEdit,
  onSaveProfile,
}: AgencyAboutUsPanelProps) {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const form = useForm<UpdateAgencyProfileDto>({
    resolver: zodResolver(agencyFormSchema),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: toFormValues(profile),
  });

  useEffect(() => {
    if (profile) {
      form.reset(toFormValues(profile));
    }
  }, [profile, form]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    void form.handleSubmit(async (values) => {
      setStatusMessage(null);
      setErrorMessage(null);
      try {
        await onSaveProfile(values);
        setStatusMessage(
          "Saved About Us profile. Every AI chat now knows your agency and representative details."
        );
      } catch (err) {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Failed to save agency profile."
        );
      }
    })(e);
  };

  const hasIdentity = Boolean(
    profile?.companyName?.trim() || profile?.representativeName?.trim()
  );

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="rounded-xl bg-[#e7f3ff]/65 dark:bg-[#0084ff]/10 border border-[#0084ff]/20 px-3.5 py-2.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 font-semibold text-[#0084ff] dark:text-[#4599ff]">
            <Building2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Agency Identity Active Across All Chats</span>
          </div>
          <p className="text-[11px] text-[#65676b] dark:text-[#8696a0] leading-relaxed">
            Details saved here are automatically injected into every project
            chat so the AI always knows your company, address, services, and
            representative when drafting outreach, proposals, or replies.
          </p>
        </div>

        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 self-start sm:self-center ${
            hasIdentity
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
          }`}
        >
          <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
          <span>{hasIdentity ? "Configured" : "Not configured yet"}</span>
        </span>
      </div>

      <div aria-live="polite" className="space-y-2">
        {errorMessage && (
          <div
            role="alert"
            className="rounded-xl bg-rose-500/12 border border-rose-500/30 px-3 py-2 text-xs text-rose-700 dark:text-rose-300 font-medium"
          >
            {errorMessage}
          </div>
        )}
        {statusMessage && (
          <div className="rounded-xl bg-emerald-500/12 border border-emerald-500/30 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300 font-medium">
            {statusMessage}
          </div>
        )}
      </div>

      {/* Company Details */}
      <div className="rounded-xl bg-[#f0f2f5] dark:bg-[#2a3942] p-3.5 space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#050505] dark:text-[#e9edef]">
          <Building2 className="w-3.5 h-3.5 text-[#0084ff]" aria-hidden="true" />
          <span>Agency / Company Details</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <FormField
            label="Agency / Company Name"
            error={form.formState.errors.companyName}
          >
            {(a11y) => (
              <input
                {...a11y}
                {...form.register("companyName")}
                disabled={!canEdit}
                placeholder="e.g., PulseGrowth Labs"
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-[#111b21] text-[#050505] dark:text-[#e9edef] outline-none disabled:opacity-60"
              />
            )}
          </FormField>

          <FormField
            label="Tagline"
            error={form.formState.errors.tagline}
          >
            {(a11y) => (
              <input
                {...a11y}
                {...form.register("tagline")}
                disabled={!canEdit}
                placeholder="e.g., Full-stack Web3 BD & AI Growth Agency"
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-[#111b21] text-[#050505] dark:text-[#e9edef] outline-none disabled:opacity-60"
              />
            )}
          </FormField>
        </div>

        <FormField label="About Us" error={form.formState.errors.aboutUs}>
          {(a11y) => (
            <textarea
              {...a11y}
              {...form.register("aboutUs")}
              rows={3}
              disabled={!canEdit}
              placeholder="Who we are, our track record, clients we serve, and why partners work with us..."
              className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-[#111b21] text-[#050505] dark:text-[#e9edef] outline-none resize-y disabled:opacity-60"
            />
          )}
        </FormField>

        <FormField
          label="Core Services & Offerings"
          error={form.formState.errors.services}
        >
          {(a11y) => (
            <textarea
              {...a11y}
              {...form.register("services")}
              rows={2}
              disabled={!canEdit}
              placeholder="e.g., KOL campaigns, institutional market-maker intros, MCP & AI tooling, Telegram bot growth..."
              className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-[#111b21] text-[#050505] dark:text-[#e9edef] outline-none resize-y disabled:opacity-60"
            />
          )}
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <FormField label="Website" error={form.formState.errors.website}>
            {(a11y) => (
              <input
                {...a11y}
                {...form.register("website")}
                disabled={!canEdit}
                placeholder="https://agency.xyz"
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-[#111b21] text-[#050505] dark:text-[#e9edef] outline-none disabled:opacity-60"
              />
            )}
          </FormField>

          <FormField label="Company Email" error={form.formState.errors.email}>
            {(a11y) => (
              <input
                {...a11y}
                {...form.register("email")}
                type="email"
                disabled={!canEdit}
                placeholder="hello@agency.xyz"
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-[#111b21] text-[#050505] dark:text-[#e9edef] outline-none disabled:opacity-60"
              />
            )}
          </FormField>

          <FormField label="Company Phone" error={form.formState.errors.phone}>
            {(a11y) => (
              <input
                {...a11y}
                {...form.register("phone")}
                disabled={!canEdit}
                placeholder="+1 (555) 123-4567"
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-[#111b21] text-[#050505] dark:text-[#e9edef] outline-none disabled:opacity-60"
              />
            )}
          </FormField>
        </div>
      </div>

      {/* Address */}
      <div className="rounded-xl bg-[#f0f2f5] dark:bg-[#2a3942] p-3.5 space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#050505] dark:text-[#e9edef]">
          <MapPin className="w-3.5 h-3.5 text-[#00a884]" aria-hidden="true" />
          <span>Office Address</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
          <FormField
            label="Street Address"
            error={form.formState.errors.address}
            className="sm:col-span-2"
          >
            {(a11y) => (
              <input
                {...a11y}
                {...form.register("address")}
                disabled={!canEdit}
                placeholder="e.g., 548 Market St, Suite 4200"
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-[#111b21] text-[#050505] dark:text-[#e9edef] outline-none disabled:opacity-60"
              />
            )}
          </FormField>

          <FormField label="City / State" error={form.formState.errors.city}>
            {(a11y) => (
              <input
                {...a11y}
                {...form.register("city")}
                disabled={!canEdit}
                placeholder="San Francisco, CA"
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-[#111b21] text-[#050505] dark:text-[#e9edef] outline-none disabled:opacity-60"
              />
            )}
          </FormField>

          <FormField label="Country" error={form.formState.errors.country}>
            {(a11y) => (
              <input
                {...a11y}
                {...form.register("country")}
                disabled={!canEdit}
                placeholder="United States"
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-[#111b21] text-[#050505] dark:text-[#e9edef] outline-none disabled:opacity-60"
              />
            )}
          </FormField>
        </div>
      </div>

      {/* Representative Details */}
      <div className="rounded-xl bg-[#f0f2f5] dark:bg-[#2a3942] p-3.5 space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#050505] dark:text-[#e9edef]">
          <UserCheck className="w-3.5 h-3.5 text-[#0084ff]" aria-hidden="true" />
          <span>Representative Details (Who the AI Speaks As)</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <FormField
            label="Representative Name"
            error={form.formState.errors.representativeName}
          >
            {(a11y) => (
              <input
                {...a11y}
                {...form.register("representativeName")}
                disabled={!canEdit}
                placeholder="e.g., Alex Vance"
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-[#111b21] text-[#050505] dark:text-[#e9edef] outline-none disabled:opacity-60"
              />
            )}
          </FormField>

          <FormField
            label="Role / Title"
            error={form.formState.errors.representativeTitle}
          >
            {(a11y) => (
              <input
                {...a11y}
                {...form.register("representativeTitle")}
                disabled={!canEdit}
                placeholder="e.g., Managing Partner / Head of BD"
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-[#111b21] text-[#050505] dark:text-[#e9edef] outline-none disabled:opacity-60"
              />
            )}
          </FormField>

          <FormField
            label="Representative Email"
            error={form.formState.errors.representativeEmail}
          >
            {(a11y) => (
              <input
                {...a11y}
                {...form.register("representativeEmail")}
                type="email"
                disabled={!canEdit}
                placeholder="alex@agency.xyz"
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-[#111b21] text-[#050505] dark:text-[#e9edef] outline-none disabled:opacity-60"
              />
            )}
          </FormField>

          <FormField
            label="Representative Phone / WhatsApp"
            error={form.formState.errors.representativePhone}
          >
            {(a11y) => (
              <input
                {...a11y}
                {...form.register("representativePhone")}
                disabled={!canEdit}
                placeholder="+1 (555) 987-6543"
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-[#111b21] text-[#050505] dark:text-[#e9edef] outline-none disabled:opacity-60"
              />
            )}
          </FormField>
        </div>
      </div>

      {/* Social Links & Notes */}
      <div className="rounded-xl bg-[#f0f2f5] dark:bg-[#2a3942] p-3.5 space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#050505] dark:text-[#e9edef]">
          <Globe className="w-3.5 h-3.5 text-[#0084ff]" aria-hidden="true" />
          <span>Social Channels & Outreach Guidelines</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <FormField
            label="Agency LinkedIn"
            error={form.formState.errors.socialLinks?.linkedin}
          >
            {(a11y) => (
              <input
                {...a11y}
                {...form.register("socialLinks.linkedin")}
                disabled={!canEdit}
                placeholder="https://linkedin.com/company/your-agency"
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-[#111b21] text-[#050505] dark:text-[#e9edef] outline-none disabled:opacity-60"
              />
            )}
          </FormField>

          <FormField
            label="Agency X (Twitter)"
            error={form.formState.errors.socialLinks?.x}
          >
            {(a11y) => (
              <input
                {...a11y}
                {...form.register("socialLinks.x")}
                disabled={!canEdit}
                placeholder="https://x.com/youragency"
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-[#111b21] text-[#050505] dark:text-[#e9edef] outline-none disabled:opacity-60"
              />
            )}
          </FormField>

          <FormField
            label="Agency Telegram"
            error={form.formState.errors.socialLinks?.telegram}
          >
            {(a11y) => (
              <input
                {...a11y}
                {...form.register("socialLinks.telegram")}
                disabled={!canEdit}
                placeholder="https://t.me/youragency"
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-[#111b21] text-[#050505] dark:text-[#e9edef] outline-none disabled:opacity-60"
              />
            )}
          </FormField>

          <FormField
            label="Agency Discord / Calendly"
            error={form.formState.errors.socialLinks?.discord}
          >
            {(a11y) => (
              <input
                {...a11y}
                {...form.register("socialLinks.discord")}
                disabled={!canEdit}
                placeholder="https://cal.com/youragency or Discord invite"
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-[#111b21] text-[#050505] dark:text-[#e9edef] outline-none disabled:opacity-60"
              />
            )}
          </FormField>
        </div>

        <FormField
          label="Brand Voice, Case Studies & Pitch Notes"
          error={form.formState.errors.notes}
        >
          {(a11y) => (
            <textarea
              {...a11y}
              {...form.register("notes")}
              rows={2}
              disabled={!canEdit}
              placeholder="Any signature style, case studies, pricing tiers, or call-to-action links chats should mention..."
              className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-[#111b21] text-[#050505] dark:text-[#e9edef] outline-none resize-y disabled:opacity-60"
            />
          )}
        </FormField>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
        <p className="text-[11px] text-[#65676b] dark:text-[#8696a0]">
          {profile?.updatedAt
            ? `Last updated ${new Date(profile.updatedAt).toLocaleString()}${
                profile.updatedBy ? ` by ${profile.updatedBy}` : ""
              }`
            : canEdit
              ? "Save your agency details to personalize all project chats."
              : "Read-only: ask a Manager or Admin to update About Us details."}
        </p>

        {canEdit && (
          <button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#0084ff] hover:bg-[#0073e6] disabled:opacity-50 text-white transition cursor-pointer shrink-0"
          >
            <Save className="w-3.5 h-3.5" aria-hidden="true" />
            <span>
              {form.formState.isSubmitting ? "Saving..." : "Save About Us"}
            </span>
          </button>
        )}
      </div>
    </form>
  );
}
