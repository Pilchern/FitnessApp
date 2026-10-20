import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The route handlers can't be imported here (they pull in `@/` and
// `@fitness-app/*` aliases that apps/web's vitest run does not resolve), so
// this checks the scheduling contract from the files themselves: the
// vercel.json Vercel actually reads, and the method each scheduled route
// exports. Auth is covered in lib/server/cron-auth.test.ts and the run record
// in lib/server/cron-heartbeat.test.ts.

// The Vercel project's Root Directory is apps/web, so Vercel reads
// apps/web/vercel.json and ignores one at the repo root. The Monday crons
// sat in the root file and never ran.
const appVercelJson = new URL("../../../../vercel.json", import.meta.url);
const repoRootVercelJson = new URL(
  "../../../../../../vercel.json",
  import.meta.url,
);

type CronEntry = { path: string; schedule: string };

function readCrons(): CronEntry[] {
  const config = JSON.parse(readFileSync(appVercelJson, "utf8")) as {
    crons?: CronEntry[];
  };
  return config.crons ?? [];
}

function routeSource(cronPath: string) {
  const name = cronPath.replace(/^\/api\/cron\//, "");
  return readFileSync(new URL(`./${name}/route.ts`, import.meta.url), "utf8");
}

describe("Vercel cron schedule", () => {
  it("lives in apps/web/vercel.json, not at the repo root", () => {
    expect(existsSync(appVercelJson)).toBe(true);
    expect(existsSync(repoRootVercelJson)).toBe(false);
  });

  it("schedules both Monday crons", () => {
    expect(readCrons()).toEqual([
      { path: "/api/cron/weekly-review-auto-finalize", schedule: "0 8 * * 1" },
      { path: "/api/cron/insights-generate", schedule: "0 9 * * 1" },
    ]);
  });

  it("runs each cron at most once a day (the Hobby plan limit)", () => {
    for (const { schedule } of readCrons()) {
      const [minute, hour] = schedule.split(" ");
      expect(minute).toMatch(/^\d+$/);
      expect(hour).toMatch(/^\d+$/);
    }
  });

  it("points every cron at a route that exports GET, the method Vercel Cron uses", () => {
    for (const { path } of readCrons()) {
      expect(routeSource(path)).toMatch(/export async function GET\(/);
    }
  });

  it("also accepts POST on the Monday routes, for pg_cron or a manual run", () => {
    for (const { path } of readCrons()) {
      expect(routeSource(path)).toMatch(/export const POST = GET;/);
    }
  });

  it("records a heartbeat in every scheduled route", () => {
    for (const { path } of readCrons()) {
      expect(routeSource(path)).toContain("startCronHeartbeat(");
    }
  });
});
