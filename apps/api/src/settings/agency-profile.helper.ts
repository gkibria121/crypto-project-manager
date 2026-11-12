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
    "=== SENDER IDENTITY: OUR AGENCY / ABOUT US (WHO WE ARE) ===",
    "IMPORTANT BUSINESS POSITION & ROLE SEPARATION:",
    "- WE ARE AN AGENCY / SERVICE PROVIDER pitching our services TO external companies to win projects, retainers, and collaborations FROM them.",
    "- Every project workspace in this app (e.g., IRISnet, Aetheris, etc.) is an EXTERNAL TARGET / PROSPECTIVE CLIENT COMPANY — NOT our own company.",
    "- NEVER write 'on behalf of [Target Company]' and NEVER use 'we' or 'our' to refer to the target company's product, token, or team.",
    "- Address the target company in the 2nd/3rd person (e.g., 'Hi [Target Company] team', 'your ecosystem', 'your recent launch') and present OUR agency in the 1st person ('we', 'our agency', 'I').",
    "- In signatures and contact blocks, ONLY use OUR agency's website, email, phone, address, and social handles below. NEVER attach the target company's Telegram/X/website handles to our signature.",
    "",
    profile.companyName.trim()
      ? `Our Agency / Company Name: ${profile.companyName.trim()}`
      : "",
    profile.tagline.trim() ? `Our Agency Tagline: ${profile.tagline.trim()}` : "",
    profile.aboutUs.trim() ? `About Our Agency: ${profile.aboutUs.trim()}` : "",
    profile.services.trim()
      ? `Services Our Agency Sells: ${profile.services.trim()}`
      : "",
    profile.website.trim() ? `Our Agency Website: ${profile.website.trim()}` : "",
    profile.email.trim() ? `Our Agency Email: ${profile.email.trim()}` : "",
    profile.phone.trim() ? `Our Agency Phone: ${profile.phone.trim()}` : "",
    locationParts.length > 0
      ? `Our Office Address: ${locationParts.join(", ")}`
      : "",
    socialEntries.length > 0
      ? `Our Agency Socials: ${socialEntries.join(" | ")}`
      : "",
    profile.representativeName.trim()
      ? `Our Representative Name: ${profile.representativeName.trim()}`
      : "",
    profile.representativeTitle.trim()
      ? `Our Representative Role / Title: ${profile.representativeTitle.trim()}`
      : "",
    profile.representativeEmail.trim()
      ? `Our Representative Email: ${profile.representativeEmail.trim()}`
      : "",
    profile.representativePhone.trim()
      ? `Our Representative Phone: ${profile.representativePhone.trim()}`
      : "",
    profile.notes.trim()
      ? `Our Brand Voice & Pitch Notes: ${profile.notes.trim()}`
      : "",
  ].filter(Boolean);

  return lines.join("\n");
}
