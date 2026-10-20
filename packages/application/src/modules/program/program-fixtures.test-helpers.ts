import type {
  ProgramBlock,
  ProgramExercise,
  ProgramGate,
  ProgramSession,
  TrainingProgram,
} from "@fitness-app/domain";

/** A small program shaped like the seed migration, for tests. */
export function block(
  id: string,
  name: string,
  startWeek: number,
  endWeek: number,
  scheme: Partial<ProgramBlock> = {},
): ProgramBlock {
  return {
    id,
    name,
    startWeek,
    endWeek,
    setsMin: null,
    setsMax: null,
    repsMin: null,
    repsMax: null,
    rirTarget: null,
    repScheme: null,
    sessionsFromBlockId: null,
    activation: "week",
    gateKey: null,
    fallbackBlockId: null,
    activatedOn: null,
    notes: null,
    ...scheme,
  };
}

export function exercise(
  partial: Partial<ProgramExercise> & { name: string },
): ProgramExercise {
  return {
    id: `ex-${partial.name}`,
    sessionId: "s",
    order: 0,
    blockPart: "legs",
    category: null,
    countsAsQuadSet: false,
    cue: null,
    fromWeek: null,
    untilWeek: null,
    primaryMuscle: "quads",
    readinessRequirement: "any",
    measure: "reps",
    sideMode: "bilateral",
    loadKind: "barbell",
    setsMin: null,
    setsMax: null,
    repsMin: null,
    repsMax: null,
    rirTarget: null,
    secondsTarget: null,
    distanceMetersTarget: null,
    tempo: null,
    gateKey: null,
    extraGateKey: null,
    substituteName: null,
    substituteLoadKind: null,
    substituteRepsMin: null,
    substituteRepsMax: null,
    supersetGroup: null,
    supersetOrder: null,
    notes: null,
    ...partial,
  };
}

export function session(
  partial: Partial<ProgramSession> & {
    id: string;
    blockId: string;
    dayOfWeek: number;
  },
): ProgramSession {
  return {
    sortOrder: 0,
    sessionType: "lift",
    name: partial.id,
    upperTemplateId: null,
    rideKind: null,
    minutesMin: null,
    minutesMax: null,
    structure: null,
    gateKey: null,
    isOptional: false,
    notes: null,
    exercises: [],
    ...partial,
  };
}

export function gate(
  gateKey: string,
  clearedOn: string | null = null,
): ProgramGate {
  return {
    id: `g-${gateKey}`,
    gateKey,
    label: gateKey,
    clearedOn,
    earliestOn: null,
    notes: null,
  };
}

const fridayExercises = [
  exercise({ name: "Heel-Elevated Goblet Squat", loadKind: "dumbbell" }),
  exercise({
    name: "Isometric Knee Extension",
    measure: "force",
    sideMode: "per_leg",
    loadKind: "bodyweight",
    setsMin: 5,
    setsMax: 5,
    secondsTarget: 5,
    order: 1,
  }),
  exercise({
    name: "Snap-Down to Stick",
    primaryMuscle: null,
    readinessRequirement: "normal",
    loadKind: "bodyweight",
    gateKey: "plyo",
    setsMin: 3,
    setsMax: 3,
    repsMin: 5,
    repsMax: 5,
    order: 2,
  }),
  exercise({
    name: "Double-Leg Pogo",
    primaryMuscle: null,
    readinessRequirement: "normal",
    loadKind: "bodyweight",
    gateKey: "plyo",
    setsMin: 2,
    setsMax: 2,
    repsMin: 10,
    repsMax: 10,
    order: 3,
  }),
];

const mondayExercises = [
  exercise({
    name: "Barbell Pin Squat",
    gateKey: "barbell_squat",
    substituteName: "Goblet Box Squat",
    substituteLoadKind: "dumbbell",
  }),
  exercise({
    name: "Cuff Knee Extension",
    sideMode: "per_leg",
    loadKind: "cuff",
    order: 1,
  }),
];

function weekSessions(blockId: string, thursday: "zone2" | "climb_intervals") {
  return [
    session({
      id: `${blockId}-mon`,
      blockId,
      dayOfWeek: 1,
      exercises: mondayExercises,
    }),
    session({
      id: `${blockId}-fri`,
      blockId,
      dayOfWeek: 5,
      exercises: fridayExercises,
    }),
    session({
      id: `${blockId}-tue-ride`,
      blockId,
      dayOfWeek: 2,
      sortOrder: 1,
      sessionType: "peloton",
      rideKind: "zone2",
      minutesMin: 30,
      minutesMax: 45,
    }),
    session({
      id: `${blockId}-tue-walkjog`,
      blockId,
      dayOfWeek: 2,
      sortOrder: 0,
      sessionType: "walk_jog",
      gateKey: "jog",
    }),
    session({
      id: `${blockId}-thu-ride`,
      blockId,
      dayOfWeek: 4,
      sortOrder: 1,
      sessionType: "peloton",
      rideKind: thursday,
      minutesMin: 45,
      minutesMax: 45,
      structure: thursday === "climb_intervals" ? "5 x 3 min seated" : null,
      gateKey: thursday === "climb_intervals" ? "intervals" : null,
    }),
  ];
}

export function testProgram(): TrainingProgram {
  const blocks = [
    block("onramp", "On-ramp", 9, 9, {
      setsMin: 2,
      setsMax: 3,
      repsMin: 12,
      repsMax: 12,
      rirTarget: 3,
    }),
    block("b1", "Block 1 Build", 10, 12, {
      setsMin: 3,
      setsMax: 4,
      repsMin: 10,
      repsMax: 12,
      rirTarget: 2,
    }),
    block("deload1", "Deload/Test", 13, 13, { sessionsFromBlockId: "b1" }),
    block("b2", "Block 2 Strength", 14, 17, {
      setsMin: 4,
      setsMax: 4,
      repsMin: 6,
      repsMax: 8,
      rirTarget: 2,
    }),
    block("deload2", "Deload", 18, 18, { sessionsFromBlockId: "b2" }),
    block("b3", "Block 3 Heavy + Power", 19, 22, {
      setsMin: 4,
      setsMax: 5,
      repsMin: 3,
      repsMax: 5,
      rirTarget: 2,
    }),
    block("b4", "Block 4 Sport Prep", 23, 38),
  ];
  return {
    id: "p",
    userId: "u",
    name: "ACL return",
    version: null,
    weekAnchorDate: "2026-08-17",
    returnToSportWeek: 39,
    testDayUrl: null,
    notes: null,
    blocks,
    weeks: Array.from({ length: 30 }, (_, i) => ({
      weekNumber: i + 9,
      isDeload: i + 9 === 13 || i + 9 === 18,
      notes: null,
    })),
    sessions: [
      ...weekSessions("onramp", "zone2").filter(
        (s) => s.sessionType !== "walk_jog",
      ),
      ...weekSessions("b1", "climb_intervals"),
      ...weekSessions("b2", "climb_intervals"),
    ],
    gates: [
      gate("barbell_squat"),
      gate("plyo"),
      gate("jog"),
      gate("intervals"),
    ],
  };
}

/** Replace a gate's cleared date. */
export function withGate(
  program: TrainingProgram,
  gateKey: string,
  clearedOn: string | null,
): TrainingProgram {
  return {
    ...program,
    gates: program.gates.map((g) =>
      g.gateKey === gateKey ? { ...g, clearedOn } : g,
    ),
  };
}
