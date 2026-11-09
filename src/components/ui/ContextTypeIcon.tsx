import React from "react";
import {
  AtSign,
  Briefcase,
  Globe,
  MessageSquareText,
  SendHorizontal,
} from "lucide-react";
import type { ContextType } from "@/types/project";

interface ContextTypeIconProps {
  type: ContextType;
  variant?: "sm" | "md";
}

export function ContextTypeIcon({
  type,
  variant = "md",
}: ContextTypeIconProps) {
  if (variant === "sm") {
    const smClass = "w-3 h-3 text-[#65676b] dark:text-[#8696a0]";
    switch (type) {
      case "website":
        return <Globe className={smClass} />;
      case "x_handle":
        return <AtSign className={smClass} />;
      case "linkedin":
        return <Briefcase className={smClass} />;
      case "telegram":
        return <SendHorizontal className={smClass} />;
      case "message":
        return <MessageSquareText className={smClass} />;
    }
  }

  switch (type) {
    case "website":
      return <Globe className="w-4 h-4 text-[#0084ff]" />;
    case "x_handle":
      return <AtSign className="w-4 h-4 text-[#050505] dark:text-[#e9edef]" />;
    case "linkedin":
      return <Briefcase className="w-4 h-4 text-[#0a66c2]" />;
    case "telegram":
      return <SendHorizontal className="w-4 h-4 text-[#229ed9]" />;
    case "message":
      return <MessageSquareText className="w-4 h-4 text-[#00a884]" />;
  }
}
