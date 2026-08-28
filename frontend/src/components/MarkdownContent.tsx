"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type MarkdownContentProps = {
  content: string;
  className?: string;
};

export default function MarkdownContent({
  content,
  className = "",
}: MarkdownContentProps) {
  return (
    <div
      className={[
        "prose prose-sm prose-slate max-w-none",
        "prose-headings:font-semibold prose-headings:text-slate-800",
        "prose-p:text-gray-600 prose-li:text-gray-600",
        "prose-strong:text-slate-800",
        className,
      ].join(" ")}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}