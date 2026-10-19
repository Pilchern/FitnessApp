import {
  createSupplementAction,
  deactivateSupplementAction,
  reactivateSupplementAction,
  recomputeNutritionTargetsAction,
  updateSettingsAction,
} from "../actions";
import { getSettingsPageData } from "../server";
import { DangerZone } from "./danger-zone";
import { SettingsForm } from "./settings-form";
import { SupplementsManager } from "./supplements-manager";
import { PageHeader } from "@/components/shared/page-header";
import { getProgramGates } from "@/features/program/server";
import { GatesManager } from "@/features/program/components/gates-manager";
import { getZonedDate } from "@fitness-app/application";

async function loadGates() {
  try {
    return await getProgramGates();
  } catch (error) {
    console.error("Program gates failed to load", error);
    return [];
  }
}

type SettingsScreenProps = {
  saved?: boolean;
  error?: string;
};

export async function SettingsScreen({ saved, error }: SettingsScreenProps) {
  const [data, gates] = await Promise.all([getSettingsPageData(), loadGates()]);
  const today = getZonedDate(data.profile?.timezone || "UTC")
    .toISOString()
    .slice(0, 10);

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <PageHeader title="Settings" />

      {/* Success banner */}
      {saved ? (
        <div className="rounded-2xl border border-pine/20 bg-pine/10 px-5 py-3 text-sm font-medium text-pine">
          Settings saved successfully.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-ember/20 bg-ember/10 px-5 py-3 text-sm font-medium text-ember">
          {error}
        </div>
      ) : null}

      {/* Form */}
      <SettingsForm
        profile={data.profile}
        action={updateSettingsAction}
        recomputeNutritionTargetsAction={recomputeNutritionTargetsAction}
      />

      <GatesManager gates={gates} today={today} />

      <SupplementsManager
        kind="habit"
        supplements={data.supplements}
        createAction={createSupplementAction}
        deactivateAction={deactivateSupplementAction}
        reactivateAction={reactivateSupplementAction}
      />

      <SupplementsManager
        kind="supplement"
        supplements={data.supplements}
        createAction={createSupplementAction}
        deactivateAction={deactivateSupplementAction}
        reactivateAction={reactivateSupplementAction}
      />

      <DangerZone />
    </div>
  );
}
