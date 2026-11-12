import {
  agencyProfileSchema,
  type AgencyProfile,
} from "@repo/shared";

export const DEFAULT_AGENCY_PROFILE_ID = "default";

export function emptyAgencyProfile(): AgencyProfile {
  return agencyProfileSchema.parse({});
}

export function mapAgencyProfileRowToDomain(row: {
  companyName?: string | null;
  tagline?: string | null;
  aboutUs?: string | null;
  services?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  representativeName?: string | null;
  representativeTitle?: string | null;
  representativeEmail?: string | null;
  representativePhone?: string | null;
  socialLinks?: unknown;
  notes?: string | null;
  updatedBy?: string | null;
  updatedAt?: Date | null;
} | null | undefined): AgencyProfile {
  if (!row) return emptyAgencyProfile();

  return agencyProfileSchema.parse({
    companyName: row.companyName ?? "",
    tagline: row.tagline ?? "",
    aboutUs: row.aboutUs ?? "",
    services: row.services ?? "",
    website: row.website ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    address: row.address ?? "",
    city: row.city ?? "",
    country: row.country ?? "",
    representativeName: row.representativeName ?? "",
    representativeTitle: row.representativeTitle ?? "",
    representativeEmail: row.representativeEmail ?? "",
    representativePhone: row.representativePhone ?? "",
    socialLinks:
      row.socialLinks && typeof row.socialLinks === "object"
        ? row.socialLinks
        : {},
    notes: row.notes ?? "",
    updatedBy: row.updatedBy ?? null,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
  });
}

export function hasAgencyProfileContent(profile: AgencyProfile): boolean {
  const socials = Object.values(profile.socialLinks ?? {}).some((v) =>
    Boolean(v?.trim())
  );
  return Boolean(
    profile.companyName.trim() ||
      profile.tagline.trim() ||
      profile.aboutUs.trim() ||
      profile.services.trim() ||
      profile.website.trim() ||
      profile.email.trim() ||
      profile.phone.trim() ||
      profile.address.trim() ||
      profile.city.trim() ||
      profile.country.trim() ||
      profile.representativeName.trim() ||
      profile.representativeTitle.trim() ||
      profile.representativeEmail.trim() ||
      profile.representativePhone.trim() ||
      profile.notes.trim() ||
      socials
  );
}

export function formatAgencyProfileSystemPromptSection(
  profile: AgencyProfile
): string {
  if (!hasAgencyProfileContent(profile)) return "";

  const locationParts = [profile.address, profile.city, profile.country]
    .map((p) => p.trim())
    .filter(Boolean);

  const socialEntries = Object.entries(profile.socialLinks ?? {})
    .filter(([, val]) => Boolean(val?.trim()))
    .map(([key, val]) => `${key}: ${val.trim()}`);

  const lines = [
    "[Our Agency / About Us — Sender & Company Identity]",
    "You represent the user's agency described below. Always use these real agency and representative details when introducing us, signing off outreach DMs/emails/proposals, or answering questions about who we are:",
    profile.companyName.trim()
      ? `Agency / Company Name: ${profile.companyName.trim()}`
      : "",
    profile.tagline.trim() ? `Tagline: ${profile.tagline.trim()}` : "",
    profile.aboutUs.trim() ? `About Us: ${profile.aboutUs.trim()}` : "",
    profile.services.trim()
      ? `Core Services & Capabilities: ${profile.services.trim()}`
      : "",
    profile.website.trim() ? `Agency Website: ${profile.website.trim()}` : "",
    profile.email.trim() ? `Company Email: ${profile.email.trim()}` : "",
    profile.phone.trim() ? `Company Phone: ${profile.phone.trim()}` : "",
    locationParts.length > 0
      ? `Office Address: ${locationParts.join(", ")}`
      : "",
    socialEntries.length > 0
      ? `Agency Socials: ${socialEntries.join(" | ")}`
      : "",
    profile.representativeName.trim()
      ? `Representative Name: ${profile.representativeName.trim()}`
      : "",
    profile.representativeTitle.trim()
      ? `Representative Role / Title: ${profile.representativeTitle.trim()}`
      : "",
    profile.representativeEmail.trim()
      ? `Representative Email: ${profile.representativeEmail.trim()}`
      : "",
    profile.representativePhone.trim()
      ? `Representative Phone: ${profile.representativePhone.trim()}`
      : "",
    profile.notes.trim()
      ? `Brand Voice & Outreach Notes: ${profile.notes.trim()}`
      : "",
  ].filter(Boolean);

  return lines.join("\n");
}
