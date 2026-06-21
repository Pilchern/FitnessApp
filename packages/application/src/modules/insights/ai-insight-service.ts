import { z } from "zod";
import type { InsightEngineInput } from "./insight-rules";

export type AiInsightConfig = {
  apiKey: string;
  model: string;
  enabled: boolean;
};

export type GeneratedInsight = {
  insightType: string;
  title: string;
  body: string;
  severity: "info" | "warning" | "positive";
};

const generatedInsightSchema = z.object({
  insightType: z.string(),
  title: z.string(),
  message: z.string(),
  severity: z.enum(["info", "warning", "positive"]),
});

const responseSchema = z.array(generatedInsightSchema).max(10);

function buildContext(input: InsightEngineInput & { recentJournalEntries?: string[] }): string {
  const lines: string[] = [];

  if (input.weeklyReviews.length > 0) {
    const recent = [...input.weeklyReviews]
      .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
      .slice(0, 2);
    lines.push("Weekly reviews (most recent first):");
    for (const r of recent) {
      const s = r.summary;
      lines.push(
        `  ${r.weekStart}: lifts=${s.liftsCompleted ?? 0}, rides=${s.ridesCompleted ?? 0}, zone2=${s.zone2Minutes ?? 0}min, sleep=${s.sleepAverageHours ?? "?"}h, weight=${s.averageWeightLb ?? "?"}lb, waist=${s.waistIn ?? "?"}in, alcohol=${s.alcoholTotal ?? 0}`,
      );
    }
  }

  if (input.recoveryCheckins.length > 0) {
    const recent = [...input.recoveryCheckins]
      .sort((a, b) => b.checkinDate.localeCompare(a.checkinDate))
      .slice(0, 7);
    lines.push("Recent recovery check-ins:");
    for (const c of recent) {
      const sleepH =
        c.sleepDurationMinutes != null
          ? `${(c.sleepDurationMinutes / 60).toFixed(1)}h`
          : "?";
      lines.push(
        `  ${c.checkinDate}: readiness=${c.readinessLevel ?? "?"}, sleep=${sleepH}, HRV=${c.hrv ?? "?"}, RHR=${c.restingHeartRate ?? "?"}`,
      );
    }
  }

  if (input.cardioSessions.length > 0) {
    const recent = [...input.cardioSessions]
      .sort((a, b) => b.sessionDate.localeCompare(a.sessionDate))
      .slice(0, 10);
    lines.push("Recent cardio sessions:");
    for (const s of recent) {
      lines.push(
        `  ${s.sessionDate}: kind=${s.sessionKind}, status=${s.plannedVsCompleted}`,
      );
    }
  }

  if (input.bodyMetrics.length > 0) {
    const recent = [...input.bodyMetrics]
      .sort((a, b) => b.measuredOn.localeCompare(a.measuredOn))
      .slice(0, 5);
    lines.push("Recent body metrics:");
    for (const m of recent) {
      lines.push(
        `  ${m.measuredOn}: weight=${m.weightLb ?? "?"}lb, waist=${m.waistIn ?? "?"}in`,
      );
    }
  }

  const liftsEntries = Object.entries(input.liftsCompletedByWeek).sort(([a], [b]) =>
    b.localeCompare(a),
  ).slice(0, 4);
  if (liftsEntries.length > 0) {
    lines.push("Strength sessions by week:");
    for (const [week, count] of liftsEntries) {
      lines.push(`  ${week}: ${count} sessions`);
    }
  }

  if (input.recentJournalEntries && input.recentJournalEntries.length > 0) {
    lines.push("Recent journal notes:");
    for (const entry of input.recentJournalEntries.slice(0, 3)) {
      lines.push(`  - ${entry}`);
    }
  }

  return lines.join("\n");
}

export class AiInsightService {
  constructor(private readonly config: AiInsightConfig) {}

  async generateInsights(
    input: InsightEngineInput & { recentJournalEntries?: string[] },
  ): Promise<GeneratedInsight[]> {
    if (!this.config.enabled) {
      return [];
    }

    const context = buildContext(input);

    const prompt = `You are a personal fitness coach analyzing an athlete's recent training data.

Based on the following 2-week snapshot, generate 3-5 concise, actionable insights.

Data:
${context}

Respond with a JSON array only (no markdown, no prose):
[{"insightType":"string","title":"string","message":"string","severity":"info"|"warning"|"positive"}]

Rules:
- insightType must be a short snake_case identifier like "low_hrv_trend" or "strong_strength_progress"
- title: max 8 words
- message: max 30 words, specific and actionable
- severity: "warning" for declining metrics, "positive" for progress, "info" for observations`;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": this.config.apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: 1024,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!response.ok) {
        console.error(
          `[AiInsightService] API error ${response.status}: ${await response.text()}`,
        );
        return [];
      }

      const data = (await response.json()) as {
        content: Array<{ type: string; text?: string }>;
      };
      const textBlock = data.content.find((block) => block.type === "text");
      if (!textBlock?.text) {
        console.error("[AiInsightService] No text block in response");
        return [];
      }

      const parsed = responseSchema.safeParse(JSON.parse(textBlock.text));
      if (!parsed.success) {
        console.error("[AiInsightService] Invalid response shape:", parsed.error.message);
        return [];
      }

      return parsed.data.map((item) => ({
        insightType: item.insightType,
        title: item.title,
        body: item.message,
        severity: item.severity,
      }));
    } catch (error) {
      console.error("[AiInsightService] Failed to generate insights:", error);
      return [];
    }
  }
}
