import { updateSettingsAction } from "../actions";
import { getSettingsPageData } from "../server";
import { SettingsForm } from "./settings-form";

type SettingsScreenProps = {
  saved?: boolean;
};

export async function SettingsScreen({ saved }: SettingsScreenProps) {
  const data = await getSettingsPageData();

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-[1.75rem] border border-ink/10 bg-white/80 p-6 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine">
          Settings
        </p>
        <h1 className="mt-3 font-display text-4xl text-ink">
          Settings
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-ink/80">
          Update your name, timezone, units, and training goals. Your goals
          help personalise the Weekly Review and Insights.
        </p>
      </section>

      {/* Success banner */}
      {saved ? (
        <div className="rounded-2xl border border-pine/20 bg-pine/10 px-5 py-3 text-sm font-medium text-pine">
          Settings saved successfully.
        </div>
      ) : null}

      {/* Form */}
      <SettingsForm
        profile={data.profile}
        userEmail={data.userEmail}
        action={updateSettingsAction}
      />
    </div>
  );
}
