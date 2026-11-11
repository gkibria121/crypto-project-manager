import React from "react";

interface FormattedMessageContentProps {
  content: string;
}

export function FormattedMessageContent({
  content,
}: FormattedMessageContentProps) {
  const lines = content.split("\n");

  const formatInline = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, idx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={idx} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code
            key={idx}
            className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 font-mono text-[12px]"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  return (
    <div className="space-y-1.5 text-[14px] leading-relaxed">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1" />;

        if (trimmed.startsWith("### ")) {
          return (
            <h3
              key={idx}
              className="text-[13px] font-semibold text-[#050505] dark:text-[#e9edef] pt-1"
            >
              {trimmed.replace("### ", "")}
            </h3>
          );
        }

        if (trimmed.startsWith("- ")) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className="w-1 h-1 rounded-full bg-current mt-2 shrink-0 opacity-60" />
              <p className="flex-1">{formatInline(trimmed.slice(2))}</p>
            </div>
          );
        }

        if (trimmed.startsWith("> ")) {
          return (
            <blockquote
              key={idx}
              className="border-l-2 border-[#0084ff] pl-3 py-0.5 my-1 text-[#65676b] dark:text-[#d1d7db]"
            >
              {formatInline(trimmed.slice(2))}
            </blockquote>
          );
        }

        return <p key={idx}>{formatInline(line)}</p>;
      })}
    </div>
  );
}
