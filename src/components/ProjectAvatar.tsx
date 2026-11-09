"use client";

import React from "react";
import { BUSINESS_STATUS_META, CryptoProject } from "@/types/project";
import { Camera } from "lucide-react";

export const PRESET_PROJECT_LOGOS: { label: string; url: string }[] = [
  {
    label: "Aether",
    url: `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="60" fill="#1d4ed8"/><polygon points="60,24 92,42 92,78 60,96 28,78 28,42" fill="none" stroke="#ffffff" stroke-width="7"/><circle cx="60" cy="60" r="12" fill="#ffffff"/></svg>`
    )}`,
  },
  {
    label: "zkFlow",
    url: `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="60" fill="#00a884"/><path d="M60 24 L90 38 V62 C90 80 77 93 60 99 C43 93 30 80 30 62 V38 Z" fill="none" stroke="#ffffff" stroke-width="7"/><path d="M47 60 L56 69 L75 50" fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    )}`,
  },
  {
    label: "Solvex",
    url: `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="60" fill="#0f172a"/><circle cx="60" cy="60" r="28" fill="none" stroke="#ffffff" stroke-width="7"/><path d="M32 60 H88 M60 32 V88" stroke="#ffffff" stroke-width="6" stroke-linecap="round"/></svg>`
    )}`,
  },
  {
    label: "Nebula",
    url: `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="60" fill="#334155"/><ellipse cx="60" cy="60" rx="36" ry="17" transform="rotate(-28 60 60)" fill="none" stroke="#ffffff" stroke-width="7"/><circle cx="60" cy="60" r="11" fill="#ffffff"/></svg>`
    )}`,
  },
];

interface ProjectAvatarProps {
  project: Pick<
    CryptoProject,
    "name" | "ticker" | "chain" | "avatarBg" | "logoUrl"
  > & {
    businessStatus?: CryptoProject["businessStatus"];
  };
  size?: "sm" | "md" | "lg" | "xl";
  showOnlineDot?: boolean;
  onEditClick?: () => void;
  decorative?: boolean;
}

export function ProjectAvatar({
  project,
  size = "md",
  showOnlineDot = false,
  onEditClick,
  decorative = true,
}: ProjectAvatarProps) {
  const sizeClasses = {
    sm: "w-9 h-9 text-xs",
    md: "w-10 h-10 text-xs",
    lg: "w-12 h-12 text-sm",
    xl: "w-20 h-20 text-base",
  }[size];

  const badgeContent = project.logoUrl ? (
    <img
      src={project.logoUrl}
      alt={decorative ? "" : `${project.name} profile photo`}
      className={`${sizeClasses} rounded-full object-cover bg-[#e4e6eb] dark:bg-[#202c33]`}
    />
  ) : (
    <div
      className={`${sizeClasses} rounded-full ${project.avatarBg} flex items-center justify-center text-white font-semibold select-none`}
    >
      <span className="tracking-tight leading-none">
        {project.ticker.replace("$", "").slice(0, 4)}
      </span>
    </div>
  );

  const statusMeta = project.businessStatus
    ? BUSINESS_STATUS_META[project.businessStatus]
    : null;
  const dotColorClass = statusMeta ? statusMeta.dotClass : "bg-[#00a884]";
  const dotTitle = statusMeta ? statusMeta.label : "Active";

  if (onEditClick) {
    return (
      <div className="relative inline-block shrink-0 group/avatar">
        {badgeContent}
        <button
          type="button"
          onClick={onEditClick}
          aria-label={`Change ${project.name} profile image`}
          title="Change profile photo"
          className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover/avatar:opacity-100 focus-visible:opacity-100 transition flex items-center justify-center text-white cursor-pointer"
        >
          <Camera className="w-4 h-4" />
        </button>
        {showOnlineDot && (
          <span
            title={dotTitle}
            className={`w-3 h-3 rounded-full ${dotColorClass} ring-2 ring-white dark:ring-[#111b21] absolute bottom-0 right-0 pointer-events-none`}
          />
        )}
      </div>
    );
  }

  return (
    <div className="relative shrink-0">
      {badgeContent}
      {showOnlineDot && (
        <span
          title={dotTitle}
          className={`w-3 h-3 rounded-full ${dotColorClass} ring-2 ring-white dark:ring-[#111b21] absolute bottom-0 right-0`}
        />
      )}
    </div>
  );
}
