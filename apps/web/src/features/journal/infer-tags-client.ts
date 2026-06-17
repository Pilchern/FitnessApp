const TAG_RULES: Array<[RegExp, string]> = [
  [/\b(lift|lifting|weights|strength)\b/, "strength"],
  [/\b(run|running|ran)\b/, "running"],
  [/\b(ride|riding|cycling|bike)\b/, "cycling"],
  [/\b(swim|swimming)\b/, "swimming"],
  [/\b(zone 2|zone2|z2)\b/, "zone2"],
  [/\b(vo2|intervals|hiit)\b/, "vo2"],
  [/\b(sleep|slept|insomnia)\b/, "sleep"],
  [/\b(stress|stressed|anxiety)\b/, "stress"],
  [/\b(alcohol|drinks|drinking|wine|beer)\b/, "alcohol"],
  [/\b(pr|personal record|personal best|pb)\b/, "pr"],
  [/\b(tired|fatigue|exhausted)\b/, "fatigue"],
  [/\b(sick|illness|cold|flu)\b/, "illness"],
  [/\b(travel|traveling|travelling)\b/, "travel"],
  [/\b(nutrition|diet|eating|macros)\b/, "nutrition"],
];

export function inferTagsClient(body: string, existingTags: string[]): string[] {
  const lower = body.toLowerCase();
  const tagSet = new Set(existingTags);
  for (const [pattern, tag] of TAG_RULES) {
    if (!tagSet.has(tag) && pattern.test(lower)) {
      tagSet.add(tag);
    }
  }
  return Array.from(tagSet);
}
