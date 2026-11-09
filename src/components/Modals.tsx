"use client";

import React, { useEffect, useId, useState } from "react";
import {
  ContextType,
  CryptoProject,
  ProjectBusinessStatus,
  ProjectContextItem,
  ProjectStage,
} from "@/types/project";
import {
  PRESET_PROJECT_LOGOS,
  ProjectAvatar,
} from "@/components/ProjectAvatar";
import {
  Globe,
  AtSign,
  Briefcase,
  MessageSquareText,
  SendHorizontal,
  X,
  Upload,
  Trash2,
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

function readFileAsDataUrl(
  file: File,
  onLoaded: (dataUrl: string) => void
): void {
  if (!file.type.startsWith("image/")) return;
  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result === "string") {
      onLoaded(reader.result);
    }
  };
  reader.readAsDataURL(file);
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
      summary: summary.trim() || undefined,
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
      className="m-auto w-full max-w-md rounded-2xl bg-white dark:bg-[#202c33] text-[#050505] dark:text-[#e9edef] border border-[#e4e6eb] dark:border-[#2a3942] p-0 shadow-xl"
    >
      <div className="p-5">
        <div className="flex items-center justify-between pb-3 border-b border-[#e4e6eb] dark:border-[#2a3942]">
          <div>
            <h2 id={titleId} className="text-base font-bold">
              Add Context
            </h2>
            <p className="text-xs text-[#65676b] dark:text-[#8696a0]">
              {projectName}
            </p>
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

        <form onSubmit={handleSubmit} className="space-y-3.5 mt-4">
          <div>
            <span className="block text-xs font-semibold mb-1.5 text-[#65676b] dark:text-[#8696a0]">
              Type
            </span>
            <div className="grid grid-cols-5 gap-1.5">
              {(
                [
                  {
                    id: "x_handle",
                    label: "X",
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
                    label: "Note",
                    icon: <MessageSquareText className="w-3.5 h-3.5" />,
                  },
                ] as const
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setType(option.id)}
                  className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl text-[11px] font-medium transition cursor-pointer ${
                    type === option.id
                      ? "bg-[#e7f3ff] text-[#0084ff] dark:bg-[#0084ff]/20 dark:text-[#4599ff] font-semibold"
                      : "bg-[#f0f2f5] dark:bg-[#2a3942] text-[#65676b] dark:text-[#8696a0]"
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
              className="block text-xs font-semibold mb-1 text-[#65676b] dark:text-[#8696a0]"
            >
              Title
            </label>
            <input
              id={titleInputId}
              name="context-title"
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                type === "x_handle"
                  ? "Official X Handle"
                  : type === "linkedin"
                    ? "Company LinkedIn"
                    : type === "website"
                      ? "Website & Docs"
                      : "Campaign Brief"
              }
              className="w-full px-3 py-2 text-sm rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] text-[#050505] dark:text-[#e9edef] outline-none"
            />
          </div>

          <div>
            <label
              htmlFor={valueInputId}
              className="block text-xs font-semibold mb-1 text-[#65676b] dark:text-[#8696a0]"
            >
              {type === "message" ? "Message / Note" : "Link or Handle"}
            </label>
            {type === "message" ? (
              <textarea
                id={valueInputId}
                name="context-message"
                required
                rows={3}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Enter campaign instructions or context note..."
                className="w-full px-3 py-2 text-sm rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] text-[#050505] dark:text-[#e9edef] outline-none resize-none"
              />
            ) : (
              <input
                id={valueInputId}
                name="context-identifier"
                type="text"
                required
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={
                  type === "x_handle"
                    ? "@handle"
                    : type === "linkedin"
                      ? "linkedin.com/company/..."
                      : "https://..."
                }
                className="w-full px-3 py-2 text-sm rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] text-[#050505] dark:text-[#e9edef] outline-none"
              />
            )}
          </div>

          <div>
            <label
              htmlFor={summaryInputId}
              className="block text-xs font-semibold mb-1 text-[#65676b] dark:text-[#8696a0]"
            >
              Notes (Optional)
            </label>
            <input
              id={summaryInputId}
              name="context-summary"
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Optional summary or tone note"
              className="w-full px-3 py-2 text-sm rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] text-[#050505] dark:text-[#e9edef] outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-[#65676b] dark:text-[#8696a0] hover:bg-[#f0f2f5] dark:hover:bg-[#2a3942] transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#0084ff] hover:bg-[#0073e6] text-white transition cursor-pointer"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}

interface UpdateProjectLogoDialogProps {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  project: CryptoProject;
  onUpdateLogo: (logoUrl: string | undefined) => void;
}

export function UpdateProjectLogoDialog({
  dialogRef,
  project,
  onUpdateLogo,
}: UpdateProjectLogoDialogProps) {
  const titleId = useId();
  const fileInputId = useId();
  const logoUrlInputId = useId();

  const [previewUrl, setPreviewUrl] = useState<string>(project.logoUrl ?? "");

  useEffect(() => {
    setPreviewUrl(project.logoUrl ?? "");
  }, [project.id, project.logoUrl]);

  useDialogLightDismissFallback(dialogRef);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    readFileAsDataUrl(file, (dataUrl) => {
      setPreviewUrl(dataUrl);
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateLogo(previewUrl.trim() ? previewUrl.trim() : undefined);
    dialogRef.current?.close();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...({ closedby: "any" } as React.DialogHTMLAttributes<HTMLDialogElement>)}
      className="m-auto w-full max-w-md rounded-2xl bg-white dark:bg-[#202c33] text-[#050505] dark:text-[#e9edef] border border-[#e4e6eb] dark:border-[#2a3942] p-0 shadow-xl"
    >
      <div className="p-5">
        <div className="flex items-center justify-between pb-3 border-b border-[#e4e6eb] dark:border-[#2a3942]">
          <div>
            <h2 id={titleId} className="text-base font-bold">
              Project Photo
            </h2>
            <p className="text-xs text-[#65676b] dark:text-[#8696a0]">
              {project.name} ({project.ticker})
            </p>
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

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="flex items-center gap-4 p-3.5 rounded-xl bg-[#f0f2f5] dark:bg-[#2a3942]">
            <ProjectAvatar
              project={{
                ...project,
                logoUrl: previewUrl.trim() || undefined,
              }}
              size="xl"
              showOnlineDot
              decorative={false}
            />

            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  id={fileInputId}
                  name="project-logo-file"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="visually-hidden"
                />
                <label
                  htmlFor={fileInputId}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0084ff] hover:bg-[#0073e6] text-white transition cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload photo</span>
                </label>

                {previewUrl && (
                  <button
                    type="button"
                    onClick={() => setPreviewUrl("")}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-black/5 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                )}
              </div>
              <p className="text-[11px] text-[#65676b] dark:text-[#8696a0]">
                PNG, JPG, SVG, or WebP.
              </p>
            </div>
          </div>

          <div>
            <label
              htmlFor={logoUrlInputId}
              className="block text-xs font-semibold mb-1 text-[#65676b] dark:text-[#8696a0]"
            >
              Image URL
            </label>
            <input
              id={logoUrlInputId}
              name="project-logo-url"
              type="url"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              value={previewUrl.startsWith("data:") ? "" : previewUrl}
              onChange={(e) => setPreviewUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 text-sm rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] text-[#050505] dark:text-[#e9edef] outline-none"
            />
          </div>

          <div>
            <span className="block text-xs font-semibold mb-1.5 text-[#65676b] dark:text-[#8696a0]">
              Default Icons
            </span>
            <div className="grid grid-cols-4 gap-2">
              {PRESET_PROJECT_LOGOS.map((preset) => {
                const isSelected = previewUrl === preset.url;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setPreviewUrl(preset.url)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl border text-[11px] font-medium transition cursor-pointer ${
                      isSelected
                        ? "border-[#0084ff] bg-[#e7f3ff] text-[#0084ff] dark:bg-[#0084ff]/20 dark:text-[#4599ff]"
                        : "border-[#e4e6eb] dark:border-[#2a3942] text-[#65676b] dark:text-[#8696a0]"
                    }`}
                  >
                    <img
                      src={preset.url}
                      alt=""
                      className="w-9 h-9 rounded-full object-cover"
                    />
                    <span className="truncate w-full text-center">
                      {preset.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-[#65676b] dark:text-[#8696a0] hover:bg-[#f0f2f5] dark:hover:bg-[#2a3942] transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#0084ff] hover:bg-[#0073e6] text-white transition cursor-pointer"
            >
              Save
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

const SOLID_AVATAR_COLORS = [
  "bg-[#1d4ed8]",
  "bg-[#00a884]",
  "bg-[#0f172a]",
  "bg-[#334155]",
  "bg-[#0369a1]",
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
  const statusId = useId();
  const taglineId = useId();
  const websiteId = useId();
  const xHandleId = useId();
  const linkedinId = useId();
  const newLogoFileId = useId();
  const newLogoUrlId = useId();

  const [name, setName] = useState("");
  const [ticker, setTicker] = useState("");
  const [chain, setChain] = useState("Solana");
  const [stage, setStage] = useState<ProjectStage>("Pre-TGE");
  const [businessStatus, setBusinessStatus] =
    useState<ProjectBusinessStatus>("new");
  const [tagline, setTagline] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [website, setWebsite] = useState("");
  const [xHandle, setXHandle] = useState("");
  const [linkedin, setLinkedin] = useState("");

  useDialogLightDismissFallback(dialogRef);

  const handleNewLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    readFileAsDataUrl(file, (dataUrl) => {
      setLogoUrl(dataUrl);
    });
  };

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
        isActive: true,
        updatedAt: "Now",
      });
    }
    if (xHandle.trim()) {
      const cleanHandle = xHandle.trim().startsWith("@")
        ? xHandle.trim()
        : `@${xHandle.trim()}`;
      contexts.push({
        id: `ctx-${Date.now()}-x`,
        type: "x_handle",
        title: "Official X",
        value: cleanHandle,
        url: `https://x.com/${cleanHandle.replace(/^@/, "")}`,
        isActive: true,
        updatedAt: "Now",
      });
    }
    if (linkedin.trim()) {
      contexts.push({
        id: `ctx-${Date.now()}-li`,
        type: "linkedin",
        title: "LinkedIn",
        value: linkedin.trim(),
        url: linkedin.trim().startsWith("http")
          ? linkedin.trim()
          : `https://${linkedin.trim()}`,
        isActive: true,
        updatedAt: "Now",
      });
    }

    if (tagline.trim()) {
      contexts.push({
        id: `ctx-${Date.now()}-note`,
        type: "message",
        title: "Project Positioning",
        value: tagline.trim(),
        isActive: true,
        updatedAt: "Now",
      });
    }

    const newProject: CryptoProject = {
      id: `proj-${Date.now()}`,
      name: name.trim(),
      ticker: cleanTicker,
      chain,
      stage,
      businessStatus,
      avatarBg:
        SOLID_AVATAR_COLORS[
          Math.floor(Math.random() * SOLID_AVATAR_COLORS.length)
        ],
      logoUrl: logoUrl.trim() ? logoUrl.trim() : undefined,
      tagline:
        tagline.trim() || `${chain} project (${stage})`,
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
          content: `Chat initialized for **${name.trim()} (${cleanTicker})** with ${contexts.length} context items active.`,
          timestamp: "Now",
          usedContextIds: contexts.map((c) => c.id),
        },
      ],
    };

    onCreateProject(newProject);
    setName("");
    setTicker("");
    setTagline("");
    setLogoUrl("");
    setWebsite("");
    setXHandle("");
    setLinkedin("");
    dialogRef.current?.close();
  };

  const previewTicker = ticker.trim()
    ? ticker.trim().toUpperCase()
    : "$TKN";

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...({ closedby: "any" } as React.DialogHTMLAttributes<HTMLDialogElement>)}
      className="m-auto w-full max-w-lg rounded-2xl bg-white dark:bg-[#202c33] text-[#050505] dark:text-[#e9edef] border border-[#e4e6eb] dark:border-[#2a3942] p-0 shadow-xl"
    >
      <div className="p-5">
        <div className="flex items-center justify-between pb-3 border-b border-[#e4e6eb] dark:border-[#2a3942]">
          <h2 id={titleId} className="text-base font-bold">
            New Project
          </h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Close dialog"
            className="w-8 h-8 rounded-full text-[#65676b] dark:text-[#8696a0] hover:bg-[#f0f2f5] dark:hover:bg-[#2a3942] flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 mt-4">
          <div className="flex items-center gap-3.5 p-3 rounded-xl bg-[#f0f2f5] dark:bg-[#2a3942]">
            <ProjectAvatar
              project={{
                name: name.trim() || "New Project",
                ticker: previewTicker,
                chain,
                avatarBg: SOLID_AVATAR_COLORS[0],
                logoUrl: logoUrl.trim() || undefined,
              }}
              size="lg"
              decorative
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  id={newLogoFileId}
                  name="new-project-logo-file"
                  type="file"
                  accept="image/*"
                  onChange={handleNewLogoFile}
                  className="visually-hidden"
                />
                <label
                  htmlFor={newLogoFileId}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0084ff] hover:bg-[#0073e6] text-white transition cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload photo</span>
                </label>

                <label htmlFor={newLogoUrlId} className="sr-only">
                  Image URL
                </label>
                <input
                  id={newLogoUrlId}
                  name="new-project-logo-url"
                  type="url"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  value={logoUrl.startsWith("data:") ? "" : logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="Or paste image URL..."
                  className="flex-1 min-w-36 px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-[#202c33] outline-none"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div className="col-span-2">
              <label
                htmlFor={nameId}
                className="block text-xs font-semibold mb-1 text-[#65676b] dark:text-[#8696a0]"
              >
                Project Name
              </label>
              <input
                id={nameId}
                name="project-name"
                type="text"
                required
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Hyperion ZK"
                className="w-full px-3 py-2 text-sm rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] outline-none"
              />
            </div>

            <div>
              <label
                htmlFor={tickerId}
                className="block text-xs font-semibold mb-1 text-[#65676b] dark:text-[#8696a0]"
              >
                Ticker
              </label>
              <input
                id={tickerId}
                name="project-ticker"
                type="text"
                required
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                placeholder="$HYPR"
                className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label
                htmlFor={chainId}
                className="block text-xs font-semibold mb-1 text-[#65676b] dark:text-[#8696a0]"
              >
                Chain
              </label>
              <select
                id={chainId}
                name="project-chain"
                value={chain}
                onChange={(e) => setChain(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] outline-none"
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
                className="block text-xs font-semibold mb-1 text-[#65676b] dark:text-[#8696a0]"
              >
                Stage
              </label>
              <select
                id={stageId}
                name="project-stage"
                value={stage}
                onChange={(e) => setStage(e.target.value as ProjectStage)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] outline-none"
              >
                <option value="Pre-TGE">Pre-TGE</option>
                <option value="Mainnet Live">Mainnet Live</option>
                <option value="IDO / Launchpad">IDO / Launchpad</option>
                <option value="Ecosystem Growth">Ecosystem Growth</option>
                <option value="Stealth">Stealth</option>
              </select>
            </div>

            <div>
              <label
                htmlFor={statusId}
                className="block text-xs font-semibold mb-1 text-[#65676b] dark:text-[#8696a0]"
              >
                Status
              </label>
              <select
                id={statusId}
                name="project-business-status"
                value={businessStatus}
                onChange={(e) =>
                  setBusinessStatus(e.target.value as ProjectBusinessStatus)
                }
                className="w-full px-3 py-2 text-xs rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] outline-none"
              >
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="collaborated">Collaborated</option>
                <option value="completed">Completed</option>
                <option value="unresponsive">Unresponsive</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor={taglineId}
              className="block text-xs font-semibold mb-1 text-[#65676b] dark:text-[#8696a0]"
            >
              Description / Notes
            </label>
            <input
              id={taglineId}
              name="project-tagline"
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="Short project summary..."
              className="w-full px-3 py-2 text-sm rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] outline-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1">
            <div>
              <label htmlFor={websiteId} className="sr-only">
                Website URL
              </label>
              <input
                id={websiteId}
                name="project-website"
                type="text"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="Website URL"
                className="w-full px-2.5 py-2 text-xs rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] outline-none"
              />
            </div>
            <div>
              <label htmlFor={xHandleId} className="sr-only">
                X Handle
              </label>
              <input
                id={xHandleId}
                name="project-x"
                type="text"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                value={xHandle}
                onChange={(e) => setXHandle(e.target.value)}
                placeholder="@XHandle"
                className="w-full px-2.5 py-2 text-xs rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] outline-none"
              />
            </div>
            <div>
              <label htmlFor={linkedinId} className="sr-only">
                LinkedIn URL
              </label>
              <input
                id={linkedinId}
                name="project-linkedin"
                type="text"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                placeholder="LinkedIn URL"
                className="w-full px-2.5 py-2 text-xs rounded-lg bg-[#f0f2f5] dark:bg-[#2a3942] outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-[#65676b] dark:text-[#8696a0] hover:bg-[#f0f2f5] dark:hover:bg-[#2a3942] transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#0084ff] hover:bg-[#0073e6] text-white transition cursor-pointer"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
