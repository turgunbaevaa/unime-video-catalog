type ConferenceInfoProps = {
  conferenceGroup?: string | null;
  conferencePart?: number | null;
};

/**
 * Displays conference name and part when the video belongs to a conference.
 * Renders nothing for standalone videos.
 */
export default function ConferenceInfo({
  conferenceGroup,
  conferencePart,
}: ConferenceInfoProps) {
  const name = conferenceGroup?.trim();
  if (!name) return null;

  return (
    <div>
      <span className="text-xs text-gray-400 font-medium uppercase tracking-wider block mb-1">
        Conference
      </span>
      <p className="text-sm text-slate-800">{name}</p>
      {conferencePart != null && (
        <p className="text-xs text-gray-500 mt-1">Part {conferencePart}</p>
      )}
    </div>
  );
}
