"use client";

import React from "react";
import {
  SYNC_PROVIDER_META,
  getProjectPlatformRanksList,
  type CryptoProject,
} from "@/types/project";

interface PlatformRankBadgesProps {
  project: Pick<CryptoProject, "platformRanks">;
  compact?: boolean;
  maxItems?: number;
}

function formatCompactMarketCap(amount?: number | null): string | null {
  if (amount === null || amount === undefined || !Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  if (amount >= 1_000_000_000_000) {
    return `$${(amount / 1_000_000_000_000).toFixed(2)}T`;
  }
  if (amount >= 1_000_000_000) {
    return `$${(amount / 1_000_000_000).toFixed(2)}B`;
  }
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M`;
  }
  return `$${Math.round(amount).toLocaleString("en-US")}`;
}

export function PlatformRankBadges({
  project,
  compact = false,
  maxItems,
}: PlatformRankBadgesProps) {
  const allRanks = getProjectPlatformRanksList(project);
  if (allRanks.length === 0) return null;

  const visibleRanks =
    typeof maxItems === "number" ? allRanks.slice(0, maxItems) : allRanks;
  const hiddenCount = allRanks.length - visibleRanks.length;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {visibleRanks.map((entry) => {
        const meta = SYNC_PROVIDER_META[entry.provider];
        const mcap = formatCompactMarketCap(entry.marketCapUsd);
        const title = `${entry.providerName || meta.shortLabel}: Rank #${entry.rank}${mcap ? ` · Market Cap ${mcap}` : ""}`;
        return (
          <span
            key={entry.provider}
            title={title}
            className={`inline-flex items-center gap-1 rounded-full font-mono font-semibold ${
              compact ? "px-1.5 py-0.2 text-[9px]" : "px-2 py-0.5 text-[10px]"
            } ${meta.badgeClass}`}
          >
            <span>{entry.providerName || meta.shortLabel}</span>
            <span>#{entry.rank}</span>
            {!compact && mcap && (
              <span className="opacity-80 font-normal">({mcap})</span>
            )}
          </span>
        );
      })}
      {hiddenCount > 0 && (
        <span
          title={allRanks
            .slice(visibleRanks.length)
            .map((r) => `${r.providerName} #${r.rank}`)
            .join(", ")}
          className="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-semibold bg-[#f0f2f5] dark:bg-[#2a3942] text-[#65676b] dark:text-[#8696a0]"
        >
          +{hiddenCount}
        </span>
      )}
    </div>
  );
}
