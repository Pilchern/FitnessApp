import { z } from "zod";
import type { WeeklyReviewAiDraft, WeeklyReviewSummary } from "@fitness-app/domain";

export type AiWeeklyReviewConfig = {
  apiKey: string;
  model: string;
  enabled: boolean;
};

export type AiWeeklyReviewInput = {
  weekStart: string;
  weekEnd: string;
  summary: WeeklyReviewSummary;
};

const aiWeeklyReviewResponseSchema = z.object({
  score: z.number().int().min(1).max(100),
  scoreRationale: z.string().min(1),
  whatWorked: z.string().min(1),
  whatNeedsAttention: z.string().min(1),
  strategicDecision: z.string().min(1),
  riskForecast: z.string().min(1),
  nextBestAction: z.string().min(1),
});

export type AiWeeklyReviewResponse = z.infer<typeof aiWeeklyReviewResponseSchema>;

function buildContext(input: AiWeeklyReviewInput): string {
  const s = input.summary;
  const lines: string[] = [];

  lines.push(`Week: ${input.weekStart} to ${input.weekEnd}`);
  lines.push(
    `Lifts completed: ${s.liftsCompleted ?? 0}`,
  );
  lines.push(`Cardio sessions completed: ${s.ridesCompleted ?? 0}`);
  lines.push(`Zone 2 minutes: ${s.zone2Minutes ?? 0}`);
  lines.push(`VO2 session completed: ${s.vo2Completed ? "yes" : "no"}`);
  lines.push(
    `Average sleep: ${s.sleepAverageHours != null ? `${s.sleepAverageHours}h` : "no data"}`,
  );
  lines.push(
    `Average weight: ${s.averageWeightLb != null ? `${s.averageWeightLb} lb` : "no data"}`,
  );
  lines.push(`Waist: ${s.waistIn != null ? `${s.waistIn} in` : "no data"}`);
  lines.push(
    `Alcohol drinks logged: ${s.alcoholTotal != null ? s.alcoholTotal : "no data"}`,
  );

  return lines.join("\n");
}

export class AiWeeklyReviewService {
  constructor(private readonly config: AiWeeklyReviewConfig) {}

  async generateDraft(input: AiWeeklyReviewInput): Promise<WeeklyReviewAiDraft | null> {
    if (!this.config.enabled) {
      return null;
    }

    const context = buildContext(input);

    const prompt = `You are a personal fitness coach writing a weekly review for an athlete, based on their logged training, body, sleep, and recovery data.

Data for the week:
${context}

Respond with a JSON object only (no markdown, no prose) in exactly this shape:
{"score": number, "scoreRationale": "string", "whatWorked": "string", "whatNeedsAttention": "string", "strategicDecision": "string", "riskForecast": "string", "nextBestAction": "string"}

Rules:
- score: an integer from 1 to 100 rating the overall quality of the week (consistency, recovery, progress)
- scoreRationale: max 40 words explaining the score
- whatWorked: max 40 words, specific and evidence-based
- whatNeedsAttention: max 40 words, specific and evidence-based
- strategicDecision: ONE clear, actionable decision for next week, max 25 words
- riskForecast: a 2-3 week outlook on what could go wrong if current patterns continue, max 40 words
- nextBestAction: ONE specific next action, max 20 words`;

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
          `[AiWeeklyReviewService] API error ${response.status}: ${await response.text()}`,
        );
        return null;
      }

      const data = (await response.json()) as {
        content: Array<{ type: string; text?: string }>;
      };
      const textBlock = data.content.find((block) => block.type === "text");
      if (!textBlock?.text) {
        console.error("[AiWeeklyReviewService] No text block in response");
        return null;
      }

      const parsed = aiWeeklyReviewResponseSchema.safeParse(JSON.parse(textBlock.text));
      if (!parsed.success) {
        console.error(
          "[AiWeeklyReviewService] Invalid response shape:",
          parsed.error.message,
        );
        return null;
      }

      return {
        score: parsed.data.score,
        scoreRationale: parsed.data.scoreRationale,
        whatWorked: parsed.data.whatWorked,
        whatNeedsAttention: parsed.data.whatNeedsAttention,
        strategicDecision: parsed.data.strategicDecision,
        riskForecast: parsed.data.riskForecast,
        nextBestAction: parsed.data.nextBestAction,
        model: this.config.model,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error("[AiWeeklyReviewService] Failed to generate draft:", error);
      return null;
    }
  }
}
