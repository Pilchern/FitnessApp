import type {
  AdjustedBodyFat,
  DexaCalibration,
  DexaComparison,
  DexaFieldSpec,
  TargetProgress,
} from "@fitness-app/application";
import type { DexaScan } from "@fitness-app/domain";

export type DexaPageData = {
  scans: DexaScan[];
  comparison: DexaComparison | null;
  calibrations: DexaCalibration[];
  adjustedBodyFat: AdjustedBodyFat | null;
  fields: DexaFieldSpec[];
  targets: TargetProgress[];
  /** Facility, machine and height from the latest scan, to prefill the form. */
  defaults: { facility: string; machine: string; heightIn: string };
};

export type DexaActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  saved?: string;
};
