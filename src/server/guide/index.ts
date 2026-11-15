import diagrams from "./diagrams.md?raw";
import figures from "./figures.md?raw";
import files from "./files.md?raw";
import formulas from "./formulas.md?raw";
import icons from "./icons.md?raw";
import essentials from "./index.md?raw";

export const GUIDE_TOPICS = ["figures", "diagrams", "formulas", "icons", "files"] as const;

export type GuideTopic = (typeof GUIDE_TOPICS)[number];

const TOPICS: Record<GuideTopic, string> = { figures, diagrams, formulas, icons, files };

/** The writing guide agents read before publishing: the essentials, or one topic in full. */
export function guide(topic?: GuideTopic): string {
  return topic ? TOPICS[topic] : essentials;
}
