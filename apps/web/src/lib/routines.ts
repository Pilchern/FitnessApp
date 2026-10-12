/**
 * Nick's two daily guided routines, rehab phase (ACL reconstruction, BTB
 * graft; surgeon visit week of 2026-10-26). Content follows plan doc
 * sections 4, 6 and 7:
 * - Mobility is static stretching with no knee-loaded stretches.
 * - Foundation Training is the founder hold and decompression breathing.
 * - Never kneel on the left knee. Get on and off the floor leading with the
 *   right leg, which is why everything here is standing, seated or on a bench.
 *
 * Moves that load the left knee wait for PT (listed in `afterClearance`), so
 * "right side only" steps are deliberate. Edit here after PT changes the
 * rules; each habit links to its routine by name (`habitKeyword`).
 */

export type RoutineStep = {
  name: string;
  seconds: number;
  /** One or two short lines read mid-hold. */
  cue: string;
};

export type Routine = {
  slug: string;
  title: string;
  /**
   * Lowercase word the habit name must contain, so "Mobility (15 min)" finds
   * this. A string, not a RegExp, because the routine is passed to a client
   * component.
   */
  habitKeyword: string;
  summary: string;
  /** Shown before starting; the rules that shaped the routine. */
  safety: string[];
  steps: RoutineStep[];
  /** Left out until PT clears them (ask list, plan doc section 10). */
  afterClearance: string[];
};

/** Seconds to get into position before each step's timer starts. */
export const ROUTINE_PREP_SECONDS = 5;

export const ROUTINES: Routine[] = [
  {
    slug: "foundation",
    title: "Foundation Training",
    habitKeyword: "foundation",
    summary:
      "Founder holds and decompression breathing, all standing. A posture and warm-up habit, not strength work.",
    safety: [
      "Soft knees only: a slight bend, weight in the heels. No deeper than a quarter squat.",
      "Stop any hold that pushes knee pain past 3/10.",
    ],
    steps: [
      {
        name: "Decompression breathing",
        seconds: 60,
        cue: "Stand tall, fingertips on your lower ribs. Breathe in and lift the ribs up and out; keep them up as you breathe out.",
      },
      {
        name: "Founder, arms back",
        seconds: 45,
        cue: "Feet just wider than hips, knees soft. Push hips back, chest long, arms reaching back with palms forward.",
      },
      {
        name: "Founder, arms forward",
        seconds: 45,
        cue: "Same hinge. Reach the arms forward at shoulder height, pull the hips back against them.",
      },
      {
        name: "Founder, arms overhead",
        seconds: 45,
        cue: "Keep the hinge and raise the arms overhead in line with your spine. Keep breathing into the ribs.",
      },
      {
        name: "Stand and breathe",
        seconds: 20,
        cue: "Stand up slowly, squeeze the glutes, three decompression breaths.",
      },
      {
        name: "Founder, arms back",
        seconds: 45,
        cue: "Second round. Same shallow knee bend, weight in the heels.",
      },
      {
        name: "Founder, arms forward",
        seconds: 45,
        cue: "Long spine, hips back, arms forward.",
      },
      {
        name: "Founder, arms overhead",
        seconds: 45,
        cue: "Arms overhead, ribs lifted.",
      },
      {
        name: "Stand and breathe",
        seconds: 20,
        cue: "Stand up slowly, squeeze the glutes, three decompression breaths.",
      },
      {
        name: "Standing decompression reach",
        seconds: 60,
        cue: "Stand tall, reach both arms overhead and up, lift the ribs and grow tall. Slow breaths.",
      },
    ],
    afterClearance: [
      "Woodpecker (split-stance hinge; loads the front knee)",
      "8-point plank and prone extensions (need getting down to the floor)",
      "Kneeling founder and lunge stretch (kneeling)",
    ],
  },
  {
    slug: "mobility",
    title: "Mobility",
    habitKeyword: "mobility",
    summary:
      "Static stretches for the desk and the upper-body lifts. Standing, seated or lying on a bench; nothing loads the knee.",
    safety: [
      "Ease into each stretch to a mild pull, never pain. Breathe slowly.",
      "Lie on the bench by sitting first and swinging the legs up; get off leading with the right leg.",
      "Left leg: no knee bending under load and no twisting. Steps marked right side only are on purpose.",
    ],
    steps: [
      {
        name: "Neck side stretch, left",
        seconds: 30,
        cue: "Ear toward the left shoulder, right shoulder drops. Gentle.",
      },
      {
        name: "Neck side stretch, right",
        seconds: 30,
        cue: "Ear toward the right shoulder, left shoulder drops.",
      },
      {
        name: "Doorway chest stretch, left",
        seconds: 45,
        cue: "Left forearm on the door frame at shoulder height, step through with the right foot until the chest opens.",
      },
      {
        name: "Doorway chest stretch, right",
        seconds: 45,
        cue: "Right forearm on the frame, step through with the right foot, short step.",
      },
      {
        name: "Lat stretch on the rack",
        seconds: 60,
        cue: "Hands on the rack at hip height, step back, hips back, let the chest sink between the arms.",
      },
      {
        name: "Cross-body shoulder, left",
        seconds: 30,
        cue: "Pull the left arm across the chest at shoulder height.",
      },
      {
        name: "Cross-body shoulder, right",
        seconds: 30,
        cue: "Pull the right arm across the chest.",
      },
      {
        name: "Seated thoracic rotation",
        seconds: 60,
        cue: "Sit on the bench, arms crossed on the chest, hips still. Turn slowly left and right, a breath at each end.",
      },
      {
        name: "Seated thoracic extension",
        seconds: 45,
        cue: "Sit with the bench edge or chair back at mid-back, hands behind the head, lean back over it.",
      },
      {
        name: "Wrist flexors and extensors",
        seconds: 45,
        cue: "Arm straight, palm up, pull the fingers back; then palm down. Switch arms halfway.",
      },
      {
        name: "Hamstring with strap, right",
        seconds: 60,
        cue: "Lie on the bench, strap around the right foot, knee straight, raise the leg until a mild pull.",
      },
      {
        name: "Hamstring with strap, left",
        seconds: 60,
        cue: "Same on the left, knee straight, gentle. Stop well before pain.",
      },
      {
        name: "Calf stretch at the wall, right",
        seconds: 45,
        cue: "Hands on the wall, right leg back with the knee straight and heel down.",
      },
      {
        name: "Calf stretch at the wall, left",
        seconds: 45,
        cue: "Left leg back, knee straight, heel down. The front knee stays only slightly bent.",
      },
      {
        name: "Hip flexor, left leg back (right side only)",
        seconds: 45,
        cue: "Short split stance, right foot forward, left leg straight behind. Tuck the pelvis until the front of the left hip stretches.",
      },
      {
        name: "Seated figure-4, right (right side only)",
        seconds: 45,
        cue: "Sit tall, right ankle on the left knee, lean forward from the hips.",
      },
      {
        name: "Easy breathing",
        seconds: 30,
        cue: "Sit tall, slow breaths in through the nose, long breath out.",
      },
    ],
    afterClearance: [
      "Hip flexor with the left leg in front (loads the left knee)",
      "Figure-4 on the left (twists the left knee)",
      "Quad stretch, child's pose and kneeling stretches (deep left knee bend)",
    ],
  },
];

export function routineBySlug(slug: string): Routine | null {
  return ROUTINES.find((r) => r.slug === slug) ?? null;
}

/** The routine a habit links to, by name, or null. */
export function routineForHabit(habitName: string): Routine | null {
  const name = habitName.toLowerCase();
  return ROUTINES.find((r) => name.includes(r.habitKeyword)) ?? null;
}
