import type { EntityId } from "./ids";

export type ManualRecordSource = {
  sourceType: "manual";
  sourceProvider: null;
  sourceExternalId: null;
  importBatchId: null;
  rawImportEventId: null;
};

export type ImportedRecordSource = {
  sourceType: "imported";
  sourceProvider: string;
  sourceExternalId: string | null;
  importBatchId: EntityId | null;
  rawImportEventId: EntityId | null;
};

export type MixedRecordSource = {
  sourceType: "mixed";
  sourceProvider: string;
  sourceExternalId: string | null;
  importBatchId: EntityId | null;
  rawImportEventId: EntityId | null;
};

export type CanonicalRecordSource =
  | ManualRecordSource
  | ImportedRecordSource
  | MixedRecordSource;

export type ManualOrImportedRecordSource =
  | ManualRecordSource
  | ImportedRecordSource;

export const MANUAL_RECORD_SOURCE: ManualRecordSource = {
  sourceType: "manual",
  sourceProvider: null,
  sourceExternalId: null,
  importBatchId: null,
  rawImportEventId: null,
};
