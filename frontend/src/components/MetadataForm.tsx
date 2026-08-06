"use client";

import type { Video } from "@/src/lib/api";
import { FORM_INPUT_CLASS } from "@/src/lib/formStyles";

export type MetadataFormValues = {
  authors: string;
  tags: string;
  language: string;
  dateRecorded: string;
  description: string;
  performAi: boolean;
};

export const emptyMetadataValues = (): MetadataFormValues => ({
  authors: "",
  tags: "",
  language: "",
  dateRecorded: "",
  description: "",
  performAi: true,
});

function todayISODateFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISODate(): string {
  return todayISODateFromDate(new Date());
}

/** Convert an ISO datetime (or date) string to yyyy-mm-dd for date inputs. */
function toDateInputValue(value?: string | null): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return "";
  return todayISODateFromDate(parsed);
}

/** Populate MetadataForm values from an existing video (edit mode). */
export function metadataValuesFromVideo(video: Video): MetadataFormValues {
  const status = video.ai_processing?.status || "pending";
  return {
    authors: (video.authors ?? []).join(", "),
    tags: (video.tags ?? []).join(", "),
    language: video.ai_processing?.language?.trim() || "",
    dateRecorded: toDateInputValue(video.date_recorded),
    description: video.description?.trim() || "",
    performAi: status !== "skipped",
  };
}

type MetadataFormProps = {
  values: MetadataFormValues;
  onChange: (patch: Partial<MetadataFormValues>) => void;
  disabled?: boolean;
  /** When true, authors helper mentions application to all imported videos */
  bulk?: boolean;
  /** Edit mode: same fields; AI checkbox wording stays consistent */
  mode?: "create" | "edit";
  maxDate?: string;
};

/** Returns true when the yyyy-mm-dd value is after today. */
export function isFutureDate(value: string): boolean {
  if (!value.trim()) return false;
  return value.trim() > todayISODate();
}

/** Split a comma-separated field into trimmed non-empty tokens. */
export function parseCommaSeparated(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export default function MetadataForm({
  values,
  onChange,
  disabled = false,
  bulk = false,
  mode = "create",
  maxDate = todayISODate(),
}: MetadataFormProps) {
  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="meta-authors" className="block text-sm font-medium text-slate-700 mb-1">
          Authors
        </label>
        <input
          id="meta-authors"
          type="text"
          value={values.authors}
          onChange={(e) => onChange({ authors: e.target.value })}
          disabled={disabled}
          placeholder={
            bulk
              ? "Comma-separated names (applied to all imported videos)"
              : "Comma-separated names"
          }
          className={FORM_INPUT_CLASS}
        />
      </div>

      <div>
        <label htmlFor="meta-tags" className="block text-sm font-medium text-slate-700 mb-1">
          Tags
        </label>
        <input
          id="meta-tags"
          type="text"
          value={values.tags}
          onChange={(e) => onChange({ tags: e.target.value })}
          disabled={disabled}
          placeholder="Comma-separated tags"
          className={FORM_INPUT_CLASS}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="meta-language" className="block text-sm font-medium text-slate-700 mb-1">
            Language
          </label>
          <input
            id="meta-language"
            type="text"
            value={values.language}
            onChange={(e) => onChange({ language: e.target.value })}
            disabled={disabled}
            placeholder="e.g. en, it"
            className={FORM_INPUT_CLASS}
          />
        </div>
        <div>
          <label
            htmlFor="meta-dateRecorded"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Date recorded
          </label>
          <input
            id="meta-dateRecorded"
            type="date"
            value={values.dateRecorded}
            max={maxDate}
            onChange={(e) => onChange({ dateRecorded: e.target.value })}
            disabled={disabled}
            className={FORM_INPUT_CLASS}
          />
        </div>
      </div>

      <div>
        <label htmlFor="meta-description" className="block text-sm font-medium text-slate-700 mb-1">
          Description
        </label>
        <textarea
          id="meta-description"
          rows={3}
          value={values.description}
          onChange={(e) => onChange({ description: e.target.value })}
          disabled={disabled}
          className={`${FORM_INPUT_CLASS} resize-none`}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
        <input
          type="checkbox"
          checked={values.performAi}
          onChange={(e) => onChange({ performAi: e.target.checked })}
          disabled={disabled}
          className="rounded border-gray-300"
        />
        {mode === "edit"
          ? "Perform AI processing (pending when enabled; skipped when disabled)"
          : "Perform AI processing (marks videos as pending for transcription)"}
      </label>
    </div>
  );
}
