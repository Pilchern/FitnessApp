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

/** Fuller instructions behind a tap, for learning a move. */
export type HowTo = {
  /** Setup and movement, in order. */
  steps: string[];
  /** Where the stretch or effort should land. */
  feel: string;
  /** The usual mistake. */
  avoid: string;
  /**
   * YouTube search for a demo. A search rather than a fixed video so the
   * link cannot go dead; demos may show deeper or floor versions.
   */
  video?: string;
};

export type RoutineStep = {
  name: string;
  seconds: number;
  /** One or two short lines read mid-hold. */
  cue: string;
  howTo: HowTo;
};

const FOUNDER_VIDEO = "foundation training founder exercise Eric Goodman";
const DECOMPRESSION_VIDEO = "foundation training decompression breathing";

const HOW_TO = {
  decompression: {
    steps: [
      "Stand tall, feet hip-width, knees soft.",
      "Fingertips on the bottom of your ribs, thumbs toward your back.",
      "Breathe in through the nose and widen the ribs into your fingers, lifting the chest up and out.",
      "Breathe out slowly but keep the ribs lifted. Tighten the belly a little instead of letting the chest drop.",
    ],
    feel: "A stretch between the ribs and a long spine. Abs lightly working on each breath out.",
    avoid:
      "Shrugging the shoulders up, or arching the low back to fake a lifted chest.",
    video: DECOMPRESSION_VIDEO,
  },
  founderBack: {
    steps: [
      "Feet a little wider than hips, weight in the heels, knees slightly bent.",
      "Push the hips straight back, like closing a car door with your butt. The chest tips forward, back stays flat.",
      "Reach both arms back beside the hips, palms facing forward, thumbs turned out.",
      "Keep breathing into the ribs and keep the hips pushed back the whole hold.",
    ],
    feel: "Hamstrings and glutes loaded, back muscles working to keep the spine long. Shaking is normal.",
    avoid:
      "Bending the knees to get lower. The hinge comes from the hips; the knees stay at a quarter squat or less.",
    video: FOUNDER_VIDEO,
  },
  founderForward: {
    steps: [
      "Same hinge: hips back, knees soft, back flat, weight in the heels.",
      "Bring the arms forward to shoulder height, palms facing each other.",
      "Reach the fingers forward while pulling the hips back, as if stretched in two directions.",
      "Hold and breathe into the ribs.",
    ],
    feel: "A long pull down the back of the legs and up the spine. Shoulders working to hold the arms up.",
    avoid: "Rounding the upper back or letting the arms sag.",
    video: FOUNDER_VIDEO,
  },
  founderOverhead: {
    steps: [
      "From the arms-forward founder, raise the arms until they line up with your spine, biceps by the ears.",
      "Keep the hips back and the chest long. Don't stand up to make it easier.",
      "Hold and breathe.",
    ],
    feel: "The hardest of the three: the whole back of the body working, upper back and shoulders burning.",
    avoid:
      "Arching the low back or flaring the ribs to get the arms higher. Lower the arms a little instead.",
    video: FOUNDER_VIDEO,
  },
  standAndBreathe: {
    steps: [
      "Press through the heels and stand up slowly, back flat on the way up.",
      "At the top squeeze the glutes, hips fully forward.",
      "Three decompression breaths: ribs up on the breath in, keep them up on the breath out.",
    ],
    feel: "Glutes tight, spine tall. A short rest between rounds.",
    avoid: "Snapping up fast or leaning back past upright.",
    video: DECOMPRESSION_VIDEO,
  },
  decompressionReach: {
    steps: [
      "Stand tall, feet hip-width, knees soft.",
      "Reach both arms straight overhead, fingers to the ceiling.",
      "Breathe in and lift the ribs; reach higher, as if growing an inch.",
      "Breathe out without letting the ribs drop. Shoulders stay away from the ears.",
    ],
    feel: "A stretch along the sides of the torso and between the ribs.",
    avoid: "Leaning back or arching the low back. The reach goes up, not back.",
    video: DECOMPRESSION_VIDEO,
  },
  neckSide: {
    steps: [
      "Sit or stand tall, shoulders relaxed.",
      "Tip the ear toward the shoulder on that side. Tilt only; don't turn the head.",
      "Let the other shoulder drop toward the floor. For more, hold the chair seat with that hand.",
      "Hold still and breathe. No bouncing.",
    ],
    feel: "Along the side of the neck into the top of the opposite shoulder.",
    avoid:
      "Pulling the head down with your hand, or lifting the shoulder to meet the ear.",
    video: "upper trapezius neck side stretch",
  },
  doorwayChest: {
    steps: [
      "Stand in a doorway. Bend the elbow to 90 degrees and lay the forearm flat on the frame, elbow at shoulder height.",
      "Take a short step through with the right foot (both sides, so the left leg never leads).",
      "Lean forward until the front of the chest and shoulder opens. Keep the shoulder blade back and down.",
      "Turn the chest slightly away from the arm for a bit more.",
    ],
    feel: "Across the chest and the front of the shoulder.",
    avoid:
      "Pinching or tingling in the shoulder: move the elbow a little lower. Don't let the head poke forward.",
    video: "doorway pec stretch",
  },
  lat: {
    steps: [
      "Face the rack (or a counter) and hold it at about hip height, arms straight.",
      "Walk the feet back until arms and torso form a straight line, feet under the hips, knees soft.",
      "Push the hips back and let the chest sink toward the floor between the arms.",
      "To bias one side, shift the hips slightly to the other side.",
    ],
    feel: "Down the sides of the back, through the armpits and the back of the shoulders.",
    avoid:
      "Bending the knees deeply to get lower. Keep the knee bend small and let the chest drop instead.",
    video: "standing lat stretch on rack",
  },
  crossBody: {
    steps: [
      "Stand or sit tall. Bring one arm straight across the chest at shoulder height.",
      "Hook the other forearm just above the elbow, not on the joint, and draw the arm closer.",
      "Keep the shoulder down, away from the ear, and the chest facing forward.",
    ],
    feel: "The back of the shoulder and between the shoulder blade and spine.",
    avoid: "Turning the whole body to follow the arm, or shrugging.",
    video: "cross body shoulder stretch",
  },
  thoracicRotation: {
    steps: [
      "Sit on the bench, feet flat and hip-width, knees over the ankles.",
      "Cross the arms on the chest, hands on the opposite shoulders. Sit tall.",
      "Turn the chest slowly to the left with the hips and knees still pointing ahead. Breathe out at the end of the turn.",
      "Come back through the middle and turn right. Slow reps for the whole minute.",
    ],
    feel: "Rotation through the mid-back, between the shoulder blades.",
    avoid:
      "Letting the knees or hips turn with you. That moves the twist into the knee; keep the legs still.",
    video: "seated thoracic rotation",
  },
  thoracicExtension: {
    steps: [
      "Sit on a chair with a back, the top of the backrest at the bottom of your shoulder blades.",
      "Hands behind the head, elbows forward, chin slightly tucked.",
      "Lean back over the backrest, opening the chest to the ceiling. Pause, breathe out, sit back up.",
      "Repeat slowly for the whole time.",
    ],
    feel: "The upper and mid-back opening up, and a stretch across the chest.",
    avoid:
      "Bending at the low back or neck instead. Keep the ribs down so the move happens at the shoulder blades.",
    video: "seated thoracic extension over chair",
  },
  wrists: {
    steps: [
      "Hold one arm straight out in front, palm up.",
      "With the other hand, gently pull the fingers back toward the floor. About 10 seconds.",
      "Turn the palm down and gently press the back of the hand so the fingers point down. About 10 seconds.",
      "Switch arms halfway through.",
    ],
    feel: "The forearm: the underside with palm up, the top with palm down.",
    avoid:
      "Bending the elbow or pulling hard. Small muscles; light pressure is enough.",
    video: "wrist flexor and extensor stretch",
  },
  hamstringStrap: {
    steps: [
      "Sit on the bench, swing the legs up and lie back. The other leg rests flat on the bench.",
      "Loop a strap, towel or belt around the ball of the foot.",
      "Keep the knee straight and raise the leg with the strap until you feel a mild pull behind the thigh.",
      "Head and shoulders down. The strap does the work; the leg stays relaxed.",
    ],
    feel: "The back of the thigh, sometimes the calf. A 3 or 4 out of 10 pull, no more.",
    avoid:
      "Bending the knee to get the leg higher, or lifting the hips off the bench.",
    video: "lying hamstring stretch with strap",
  },
  calf: {
    steps: [
      "Stand facing a wall, hands on it at chest height.",
      "Step one leg back about two feet: knee straight, heel flat, toes pointing at the wall.",
      "Lean the hips toward the wall until the back calf stretches. The front knee bends only slightly.",
    ],
    feel: "The back calf, from behind the knee down to the heel.",
    avoid: "Letting the back heel lift or the back foot turn out.",
    video: "standing wall calf stretch straight knee",
  },
  hipFlexor: {
    steps: [
      "Hold a wall or the rack for balance. Right foot forward, left leg straight behind in a short split stance.",
      "Left knee straight, left heel down or slightly lifted.",
      "Tuck the pelvis under: squeeze the left glute and bring the belt buckle up toward the ribs.",
      "Shift forward only a little if you need more. The right knee stays over the right ankle.",
    ],
    feel: "The front of the left hip, high on the thigh.",
    avoid:
      "Arching the low back and lunging deeper. The tuck makes the stretch, not the depth.",
    video: "standing hip flexor stretch pelvic tilt",
  },
  figure4: {
    steps: [
      "Sit tall on the bench, both feet flat.",
      "Cross the right ankle over the left knee and let the right knee fall open.",
      "Keep the back straight and lean forward from the hips until you feel the stretch.",
      "The left foot stays planted and the left knee points straight ahead.",
    ],
    feel: "Deep in the right buttock and outer hip.",
    avoid: "Rounding the back to get lower, or pushing down on the right knee.",
    video: "seated figure 4 stretch",
  },
  easyBreathing: {
    steps: [
      "Sit tall, hands on the thighs, shoulders relaxed.",
      "Breathe in through the nose for about 4 seconds, belly and ribs expanding.",
      "Breathe out slowly for about 6 seconds.",
      "Repeat and let the heart rate settle.",
    ],
    feel: "Calm and slower.",
    avoid: "Forcing big breaths. Easy and slow.",
  },
} satisfies Record<string, HowTo>;

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
        howTo: HOW_TO.decompression,
      },
      {
        name: "Founder, arms back",
        seconds: 45,
        cue: "Feet just wider than hips, knees soft. Push hips back, chest long, arms reaching back with palms forward.",
        howTo: HOW_TO.founderBack,
      },
      {
        name: "Founder, arms forward",
        seconds: 45,
        cue: "Same hinge. Reach the arms forward at shoulder height, pull the hips back against them.",
        howTo: HOW_TO.founderForward,
      },
      {
        name: "Founder, arms overhead",
        seconds: 45,
        cue: "Keep the hinge and raise the arms overhead in line with your spine. Keep breathing into the ribs.",
        howTo: HOW_TO.founderOverhead,
      },
      {
        name: "Stand and breathe",
        seconds: 20,
        cue: "Stand up slowly, squeeze the glutes, three decompression breaths.",
        howTo: HOW_TO.standAndBreathe,
      },
      {
        name: "Founder, arms back",
        seconds: 45,
        cue: "Second round. Same shallow knee bend, weight in the heels.",
        howTo: HOW_TO.founderBack,
      },
      {
        name: "Founder, arms forward",
        seconds: 45,
        cue: "Long spine, hips back, arms forward.",
        howTo: HOW_TO.founderForward,
      },
      {
        name: "Founder, arms overhead",
        seconds: 45,
        cue: "Arms overhead, ribs lifted.",
        howTo: HOW_TO.founderOverhead,
      },
      {
        name: "Stand and breathe",
        seconds: 20,
        cue: "Stand up slowly, squeeze the glutes, three decompression breaths.",
        howTo: HOW_TO.standAndBreathe,
      },
      {
        name: "Standing decompression reach",
        seconds: 60,
        cue: "Stand tall, reach both arms overhead and up, lift the ribs and grow tall. Slow breaths.",
        howTo: HOW_TO.decompressionReach,
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
      "Static stretches for the desk and lift days. Standing, seated or lying on a bench; nothing loads the knee.",
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
        howTo: HOW_TO.neckSide,
      },
      {
        name: "Neck side stretch, right",
        seconds: 30,
        cue: "Ear toward the right shoulder, left shoulder drops.",
        howTo: HOW_TO.neckSide,
      },
      {
        name: "Doorway chest stretch, left",
        seconds: 45,
        cue: "Left forearm on the door frame at shoulder height, step through with the right foot until the chest opens.",
        howTo: HOW_TO.doorwayChest,
      },
      {
        name: "Doorway chest stretch, right",
        seconds: 45,
        cue: "Right forearm on the frame, step through with the right foot, short step.",
        howTo: HOW_TO.doorwayChest,
      },
      {
        name: "Lat stretch on the rack",
        seconds: 60,
        cue: "Hands on the rack at hip height, step back, hips back, let the chest sink between the arms.",
        howTo: HOW_TO.lat,
      },
      {
        name: "Cross-body shoulder, left",
        seconds: 30,
        cue: "Pull the left arm across the chest at shoulder height.",
        howTo: HOW_TO.crossBody,
      },
      {
        name: "Cross-body shoulder, right",
        seconds: 30,
        cue: "Pull the right arm across the chest.",
        howTo: HOW_TO.crossBody,
      },
      {
        name: "Seated thoracic rotation",
        seconds: 60,
        cue: "Sit on the bench, arms crossed on the chest, hips still. Turn slowly left and right, a breath at each end.",
        howTo: HOW_TO.thoracicRotation,
      },
      {
        name: "Seated thoracic extension",
        seconds: 45,
        cue: "Sit with the bench edge or chair back at mid-back, hands behind the head, lean back over it.",
        howTo: HOW_TO.thoracicExtension,
      },
      {
        name: "Wrist flexors and extensors",
        seconds: 45,
        cue: "Arm straight, palm up, pull the fingers back; then palm down. Switch arms halfway.",
        howTo: HOW_TO.wrists,
      },
      {
        name: "Hamstring with strap, right",
        seconds: 60,
        cue: "Lie on the bench, strap around the right foot, knee straight, raise the leg until a mild pull.",
        howTo: HOW_TO.hamstringStrap,
      },
      {
        name: "Hamstring with strap, left",
        seconds: 60,
        cue: "Same on the left, knee straight, gentle. Stop well before pain.",
        howTo: HOW_TO.hamstringStrap,
      },
      {
        name: "Calf stretch at the wall, right",
        seconds: 45,
        cue: "Hands on the wall, right leg back with the knee straight and heel down.",
        howTo: HOW_TO.calf,
      },
      {
        name: "Calf stretch at the wall, left",
        seconds: 45,
        cue: "Left leg back, knee straight, heel down. The front knee stays only slightly bent.",
        howTo: HOW_TO.calf,
      },
      {
        name: "Hip flexor, left leg back (right side only)",
        seconds: 45,
        cue: "Short split stance, right foot forward, left leg straight behind. Tuck the pelvis until the front of the left hip stretches.",
        howTo: HOW_TO.hipFlexor,
      },
      {
        name: "Seated figure-4, right (right side only)",
        seconds: 45,
        cue: "Sit tall, right ankle on the left knee, lean forward from the hips.",
        howTo: HOW_TO.figure4,
      },
      {
        name: "Easy breathing",
        seconds: 30,
        cue: "Sit tall, slow breaths in through the nose, long breath out.",
        howTo: HOW_TO.easyBreathing,
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
