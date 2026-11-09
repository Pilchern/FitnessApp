import type { GateBoard, LsiBasis } from "@fitness-app/application";
import type { KneeTest } from "@fitness-app/domain";

export type KneeActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  saved?: { date: string; rows: number };
};

export type KneePageData = {
  today: string;
  /** training_settings.quad_drop_hold_n: crane noise, newtons. */
  spreadLimitN: number;
  lsiTargets: number[];
  /** Quad LSI at 90° per crane test date (both apps), oldest first. */
  trend: {
    date: string;
    lsi: number;
    denominator: number | null;
    basis: LsiBasis;
  }[];
  latest: {
    date: string;
    left: number | null;
    right: number | null;
    lsi: number | null;
    /** The right value the LSI divided by. */
    denominator: number | null;
    basis: LsiBasis;
    /** A leg exercise was logged the calendar day before the test. */
    legSessionDayBefore: boolean;
    source: string;
  } | null;
  /** Right-leg best per crane test date, oldest first (form preview). */
  rightBests: { date: string; right: number }[];
  quadDrop: { dropN: number; previousLeft: number; left: number } | null;
  /** This app's recent entries: date and value count, newest first. */
  recent: { date: string; count: number }[];
  /** All live rows in the window, for the latest-values list. */
  tests: KneeTest[];
  /** Jog, plyo and return-to-sport criteria, green or red. */
  gates: GateBoard[];
};
