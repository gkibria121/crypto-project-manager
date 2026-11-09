"use client";

import React, { useEffect, useId, useState } from "react";
import {
  ContextType,
  CryptoProject,
  ProjectContextItem,
  ProjectStage,
} from "@/types/project";
import {
  Globe,
  AtSign,
  Briefcase,
  MessageSquareText,
  SendHorizontal,
  X,
  Sparkles,
} from "lucide-react";

function useDialogLightDismissFallback(
  dialogRef: React.RefObject<HTMLDialogElement | null>
) {
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (!("closedBy" in HTMLDialogElement.prototype)) {
      const handleClick = (event: MouseEvent) => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const isDialogContent =
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width;

        if (isDialogContent) return;
        dialog.close();
      };

      dialog.addEventListener("click", handleClick);
      return () => dialog.removeEventListener("click", handleClick);
    }
  }, [dialogRef]);
}

interface AddContextDialogProps {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  projectName: string;
  onAddContext: (item: Omit<ProjectContextItem, "id" | "updatedAt">) => void;
}

export function AddContextDialog({
  dialogRef,
  projectName,
  onAddContext,
}: AddContextDialogProps) {
  const titleId = useId();
  const titleInputId = useId();
  const valueInputId = useId();
  const summaryInputId = useId();

  const [type, setType] = useState<ContextType>("x_handle");
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [summary, setSummary] = useState("");

  useDialogLightDismissFallback(dialogRef);

  const normalizeUrl = (rawType: ContextType, rawVal: string) => {
    const v = rawVal.trim();
    if (rawType === "message") return undefined;
    if (v.startsWith("http://") || v.startsWith("https://")) return v;
    if (rawType === "x_handle") {
      return `https://x.com/${v.replace(/^@/, "")}`;
    }
    return `https://${v}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !value.trim()) return;

    onAddContext({
      type,
      title: title.trim(),
      value: value.trim(),
      url: normalizeUrl(type, value),
      summary:
        summary.trim() ||
        "Added by Admin for AI campaign context grounding.",
      isActive: true,
    });

    setTitle("");
    setValue("");
    setSummary("");
    dialogRef.current?.close();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...({ closedby: "any" } as React.DialogHTMLAttributes<HTMLDialogElement>)}
      className="m-auto w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 p-0 shadow-2xl"
    >
      <div className="p-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/70 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 id={titleId} className="text-sm font-bold">
                Add Project Context
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Ground AI responses for <strong>{projectName}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Close dialog"
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 mt-4">
          {/* Context Type Selector */}
          <div>
            <span className="block text-xs font-semibold mb-1.5 text-slate-700 dark:text-slate-300">
              Context Source Type
            </span>
            <div className="grid grid-cols-5 gap-1.5">
              {(
                [
                  {
                    id: "x_handle",
                    label: "X Handle",
                    icon: <AtSign className="w-3.5 h-3.5" />,
                  },
                  {
                    id: "website",
                    label: "Website",
                    icon: <Globe className="w-3.5 h-3.5" />,
                  },
                  {
                    id: "linkedin",
                    label: "LinkedIn",
                    icon: <Briefcase className="w-3.5 h-3.5" />,
                  },
                  {
                    id: "telegram",
                    label: "Telegram",
                    icon: <SendHorizontal className="w-3.5 h-3.5" />,
                  },
                  {
                    id: "message",
                    label: "Note/Brief",
                    icon: <MessageSquareText className="w-3.5 h-3.5" />,
                  },
                ] as const
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setType(option.id)}
                  className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl text-[10px] font-semibold border transition cursor-pointer ${
                    type === option.id
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                      : "bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {option.icon}
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor={titleInputId}
              className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300"
            >
              Context Label
            </label>
            <input
              id={titleInputId}
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                type === "x_handle"
                  ? "e.g., Founder X Handle or Official X"
                  : type === "linkedin"
                    ? "e.g., Executive LinkedIn Page"
                    : type === "website"
                      ? "e.g., Official Docs & Tokenomics"
                      : "e.g., Q4 KOL Campaign Guardrails"
              }
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 outline-none"
            />
          </div>

          <div>
            <label
              htmlFor={valueInputId}
              className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300"
            >
              {type === "message"
                ? "Marketing Directive / Context Message"
                : "Link or Handle"}
            </label>
            {type === "message" ? (
              <textarea
                id={valueInputId}
                required
                rows={3}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Write instructions, tokenomics facts, or campaign messaging for the AI..."
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 outline-none resize-none"
              />
            ) : (
              <input
                id={valueInputId}
                type="text"
                required
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={
                  type === "x_handle"
                    ? "@ProjectHandle"
                    : type === "linkedin"
                      ? "linkedin.com/company/your-project"
                      : "https://yourproject.xyz"
                }
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 outline-none"
              />
            )}
          </div>

          <div>
            <label
              htmlFor={summaryInputId}
              className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300"
            >
              AI Tone / Key Takeaways (Optional)
            </label>
            <input
              id={summaryInputId}
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="e.g., Focus on institutional RWA yield and zero slippage"
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition cursor-pointer"
            >
              Save to AI Context
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}

interface NewProjectDialogProps {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  onCreateProject: (project: CryptoProject) => void;
}

const AVATAR_GRADIENTS = [
  "from-indigo-600 via-violet-600 to-cyan-500",
  "from-emerald-500 via-teal-600 to-sky-600",
  "from-amber-500 via-orange-600 to-rose-600",
  "from-fuchsia-600 via-pink-600 to-purple-700",
];

export function NewProjectDialog({
  dialogRef,
  onCreateProject,
}: NewProjectDialogProps) {
  const titleId = useId();
  const nameId = useId();
  const tickerId = useId();
  const chainId = useId();
  const stageId = useId();
  const websiteId = useId();
  const xHandleId = useId();
  const linkedinId = useId();

  const [name, setName] = useState("");
  const [ticker, setTicker] = useState("");
  const [chain, setChain] = useState("Solana");
  const [stage, setStage] = useState<ProjectStage>("Pre-TGE");
  const [tagline, setTagline] = useState("");
  const [website, setWebsite] = useState("");
  const [xHandle, setXHandle] = useState("");
  const [linkedin, setLinkedin] = useState("");

  useDialogLightDismissFallback(dialogRef);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !ticker.trim()) return;

    const cleanTicker = ticker.trim().startsWith("$")
      ? ticker.trim().toUpperCase()
      : `$${ticker.trim().toUpperCase()}`;

    const contexts: ProjectContextItem[] = [];
    if (website.trim()) {
      contexts.push({
        id: `ctx-${Date.now()}-web`,
        type: "website",
        title: "Official Website",
        value: website.trim(),
        url: website.trim().startsWith("http")
          ? website.trim()
          : `https://${website.trim()}`,
        summary: `Primary website and narrative hub for ${name.trim()}.`,
        isActive: true,
        updatedAt: "Just now",
      });
    }
    if (xHandle.trim()) {
      const cleanHandle = xHandle.trim().startsWith("@")
        ? xHandle.trim()
        : `@${xHandle.trim()}`;
      contexts.push({
        id: `ctx-${Date.now()}-x`,
        type: "x_handle",
        title: "Official X Handle",
        value: cleanHandle,
        url: `https://x.com/${cleanHandle.replace(/^@/, "")}`,
        summary: `Crypto Twitter voice and community channel for ${cleanTicker}.`,
        isActive: true,
        updatedAt: "Just now",
      });
    }
    if (linkedin.trim()) {
      contexts.push({
        id: `ctx-${Date.now()}-li`,
        type: "linkedin",
        title: "Company LinkedIn",
        value: linkedin.trim(),
        url: linkedin.trim().startsWith("http")
          ? linkedin.trim()
          : `https://${linkedin.trim()}`,
        summary: `Institutional and B2B presence for ${name.trim()}.`,
        isActive: true,
        updatedAt: "Just now",
      });
    }

    contexts.push({
      id: `ctx-${Date.now()}-note`,
      type: "message",
      title: "Initial Campaign Positioning",
      value:
        tagline.trim() ||
        `${name.trim()} (${cleanTicker}) on ${chain} — ${stage} marketing campaign.`,
      summary: "Default campaign positioning brief.",
      isActive: true,
      updatedAt: "Pinned",
    });

    const newProject: CryptoProject = {
      id: `proj-${Date.now()}`,
      name: name.trim(),
      ticker: cleanTicker,
      chain,
      stage,
      avatarBg:
        AVATAR_GRADIENTS[Math.floor(Math.random() * AVATAR_GRADIENTS.length)],
      tagline:
        tagline.trim() ||
        `Next-gen ${chain} protocol preparing for ${stage} growth.`,
      campaignBudget: "$25,000 / mo",
      sentimentScore: 90,
      isPinned: true,
      unreadInsights: 0,
      lastActivityTime: "Now",
      contexts,
      messages: [
        {
          id: `msg-${Date.now()}`,
          sender: "ai",
          content: `Workspace initialized for **${name.trim()} (${cleanTicker})** on **${chain}**! I have indexed **${contexts.length} project contexts**. Ask me to craft your X launch thread, LinkedIn announcement, or KOL outreach plan.`,
          timestamp: "Just now",
          usedContextIds: contexts.map((c) => c.id),
        },
      ],
    };

    onCreateProject(newProject);
    setName("");
    setTicker("");
    setTagline("");
    setWebsite("");
    setXHandle("");
    setLinkedin("");
    dialogRef.current?.close();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...({ closedby: "any" } as React.DialogHTMLAttributes<HTMLDialogElement>)}
      className="m-auto w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 p-0 shadow-2xl"
    >
      <div className="p-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/70 dark:border-slate-800">
          <h2 id={titleId} className="text-sm font-bold">
            Onboard New Crypto Client Project
          </h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Close dialog"
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 mt-4">
          <div className="grid grid-cols-3 gap-2.5">
            <div className="col-span-2">
              <label
                htmlFor={nameId}
                className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300"
              >
                Project Name
              </label>
              <input
                id={nameId}
                type="text"
                required
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Hyperion ZK"
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none"
              />
            </div>

            <div>
              <label
                htmlFor={tickerId}
                className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300"
              >
                Token Ticker
              </label>
              <input
                id={tickerId}
                type="text"
                required
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                placeholder="$HYPR"
                className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label
                htmlFor={chainId}
                className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300"
              >
                Primary Chain
              </label>
              <select
                id={chainId}
                value={chain}
                onChange={(e) => setChain(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none"
              >
                <option value="Solana">Solana</option>
                <option value="Ethereum L2">Ethereum L2</option>
                <option value="Base">Base</option>
                <option value="Arbitrum">Arbitrum</option>
                <option value="Sui">Sui</option>
                <option value="Monad / EVM">Monad / EVM</option>
              </select>
            </div>

            <div>
              <label
                htmlFor={stageId}
                className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300"
              >
                Campaign Stage
              </label>
              <select
                id={stageId}
                value={stage}
                onChange={(e) => setStage(e.target.value as ProjectStage)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none"
              >
                <option value="Pre-TGE">Pre-TGE</option>
                <option value="Mainnet Live">Mainnet Live</option>
                <option value="IDO / Launchpad">IDO / Launchpad</option>
                <option value="Ecosystem Growth">Ecosystem Growth</option>
                <option value="Stealth">Stealth</option>
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="proj-tagline"
              className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300"
            >
              One-Line Narrative / Value Proposition
            </label>
            <input
              id="proj-tagline"
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="e.g., Modular liquidity aggregator with zero MEV on Solana"
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none"
            />
          </div>

          <div className="pt-1 border-t border-slate-200/60 dark:border-slate-800">
            <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 mb-2">
              Seed Initial Project Contexts (Optional)
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label htmlFor={websiteId} className="sr-only">
                  Website URL
                </label>
                <input
                  id={websiteId}
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="Website URL"
                  className="w-full px-2.5 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none"
                />
              </div>
              <div>
                <label htmlFor={xHandleId} className="sr-only">
                  X Handle
                </label>
                <input
                  id={xHandleId}
                  type="text"
                  value={xHandle}
                  onChange={(e) => setXHandle(e.target.value)}
                  placeholder="@XHandle"
                  className="w-full px-2.5 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none"
                />
              </div>
              <div>
                <label htmlFor={linkedinId} className="sr-only">
                  LinkedIn URL
                </label>
                <input
                  id={linkedinId}
                  type="text"
                  value={linkedin}
                  onChange={(e) => setLinkedin(e.target.value)}
                  placeholder="LinkedIn URL"
                  className="w-full px-2.5 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition cursor-pointer"
            >
              Create Project Workspace
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
