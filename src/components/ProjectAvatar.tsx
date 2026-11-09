"use client";

import React from "react";
import { BUSINESS_STATUS_META, CryptoProject } from "@/types/project";
import { Camera } from "lucide-react";

export const PRESET_PROJECT_LOGOS: { label: string; url: string }[] = [
  {
    label: "Aether Hex",
    url: `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#6366f1"/><stop offset="50%" stop-color="#8b5cf6"/><stop offset="100%" stop-color="#06b6d4"/></linearGradient></defs><rect width="120" height="120" rx="28" fill="url(#g1)"/><polygon points="60,20 95,40 95,80 60,100 25,80 25,40" fill="none" stroke="#ffffff" stroke-width="6"/><circle cx="60" cy="60" r="14" fill="#ffffff"/></svg>`
    )}`,
  },
  {
    label: "ZK Shield",
    url: `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#10b981"/><stop offset="100%" stop-color="#0284c7"/></linearGradient></defs><rect width="120" height="120" rx="28" fill="url(#g2)"/><path d="M60 22 L92 36 V62 C92 82 78 96 60 102 C42 96 28 82 28 62 V36 Z" fill="none" stroke="#ffffff" stroke-width="6"/><path d="M46 60 L56 70 L76 50" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    )}`,
  },
  {
    label: "Solaris RWA",
    url: `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="g3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#f59e0b"/><stop offset="100%" stop-color="#e11d48"/></linearGradient></defs><rect width="120" height="120" rx="28" fill="url(#g3)"/><circle cx="60" cy="60" r="30" fill="none" stroke="#ffffff" stroke-width="6"/><path d="M30 60 H90 M60 30 V90" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/></svg>`
    )}`,
  },
  {
    label: "Nebula Orbit",
    url: `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="g4" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#d946ef"/><stop offset="100%" stop-color="#7c3aed"/></linearGradient></defs><rect width="120" height="120" rx="28" fill="url(#g4)"/><ellipse cx="60" cy="60" rx="38" ry="18" transform="rotate(-30 60 60)" fill="none" stroke="#ffffff" stroke-width="6"/><circle cx="60" cy="60" r="12" fill="#ffffff"/></svg>`
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
    sm: "w-10 h-10 rounded-xl text-xs",
    md: "w-11 h-11 rounded-2xl text-xs",
    lg: "w-12 h-12 rounded-2xl text-xs",
    xl: "w-16 h-16 rounded-2xl text-sm",
  }[size];

  const badgeContent = project.logoUrl ? (
    <img
      src={project.logoUrl}
      alt={decorative ? "" : `${project.name} profile logo`}
      className={`${sizeClasses} object-cover bg-slate-900 shadow-sm border border-slate-200/60 dark:border-slate-800/80`}
    />
  ) : (
    <div
      className={`${sizeClasses} bg-gradient-to-br ${project.avatarBg} flex flex-col items-center justify-center text-white font-bold shadow-sm`}
    >
      <span className="tracking-tight leading-none">
        {project.ticker.replace("$", "")}
      </span>
      {size !== "sm" && (
        <span className="text-[9px] font-medium opacity-80 mt-0.5">
          {project.chain.split(" ")[0]}
        </span>
      )}
    </div>
  );

  const statusMeta = project.businessStatus
    ? BUSINESS_STATUS_META[project.businessStatus]
    : null;
  const dotColorClass = statusMeta ? statusMeta.dotClass : "bg-emerald-500";
  const dotTitle = statusMeta
    ? `Business Status: ${statusMeta.label}`
    : "AI Agent Context Ready";

  if (onEditClick) {
    return (
      <div className="relative inline-block shrink-0 group/avatar">
        {badgeContent}
        <button
          type="button"
          onClick={onEditClick}
          aria-label={`Change ${project.name} logo or profile image`}
          title={`Change ${project.name} logo`}
          className="absolute inset-0 rounded-2xl bg-slate-950/60 opacity-0 group-hover/avatar:opacity-100 focus-visible:opacity-100 transition flex flex-col items-center justify-center text-white cursor-pointer"
        >
          <Camera className="w-4 h-4" />
          {size === "xl" && (
            <span className="text-[9px] font-semibold mt-0.5">Logo</span>
          )}
        </button>
        {showOnlineDot && (
          <span
            title={dotTitle}
            className={`w-3.5 h-3.5 rounded-full ${dotColorClass} border-2 border-white dark:border-slate-950 absolute -bottom-0.5 -right-0.5 pointer-events-none`}
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
          className={`w-3.5 h-3.5 rounded-full ${dotColorClass} border-2 border-white dark:border-slate-950 absolute -bottom-0.5 -right-0.5`}
        />
      )}
    </div>
  );
}
