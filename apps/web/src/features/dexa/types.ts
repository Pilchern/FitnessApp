import type { DexaComparison, DexaFieldSpec } from "@fitness-app/application";
import type { DexaScan } from "@fitness-app/domain";

export type DexaPageData = {
  scans: DexaScan[];
  comparison: DexaComparison | null;
  fields: DexaFieldSpec[];
  /** Facility, machine and height from the latest scan, to prefill the form. */
  defaults: { facility: string; machine: string; heightIn: string };
};

export type DexaActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  saved?: string;
};
