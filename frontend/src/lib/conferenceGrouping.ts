import type { Video } from "@/src/lib/api";

export interface ConferenceItem {
  isConference: true;
  conferenceGroup: string;
  videos: Video[];
  activePartIndex: number;
}

export type DisplayItem = Video | ConferenceItem;

export function isConferenceItem(item: DisplayItem): item is ConferenceItem {
  return "isConference" in item && item.isConference === true;
}

/**
 * Split a video list into standalone videos and conference groups
 * (sorted by conference_part). Used by folder and archive views.
 */
export function groupVideosByConference(videos: Video[]): DisplayItem[] {
  const grouped = new Map<string, Video[]>();
  const singles: Video[] = [];

  videos.forEach((video) => {
    const group = video.conference_group?.trim();
    if (group) {
      if (!grouped.has(group)) {
        grouped.set(group, []);
      }
      grouped.get(group)!.push(video);
    } else {
      singles.push(video);
    }
  });

  const displayList: DisplayItem[] = [...singles];

  grouped.forEach((groupVideos, conferenceGroup) => {
    const sortedVideos = [...groupVideos].sort(
      (a, b) => (a.conference_part || 0) - (b.conference_part || 0)
    );
    displayList.push({
      isConference: true,
      conferenceGroup,
      videos: sortedVideos,
      activePartIndex: 0,
    });
  });

  return displayList;
}

/** Update active DVD/part index for a conference card in a display list. */
export function setConferenceActivePart(
  items: DisplayItem[],
  conferenceGroup: string,
  newIndex: number
): DisplayItem[] {
  return items.map((item) => {
    if (isConferenceItem(item) && item.conferenceGroup === conferenceGroup) {
      return { ...item, activePartIndex: newIndex };
    }
    return item;
  });
}
