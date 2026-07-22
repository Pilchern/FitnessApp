import type {
  CardioTrainingTemplateDefinition,
  TrainingTemplate,
} from "@fitness-app/domain";
import type {
  CreateStrengthTemplateInput,
  SetTemplateScheduleInput,
  TrainingTemplateRepository,
} from "@fitness-app/application";
import {
  cardioTrainingTemplateDefinitionSchema,
  strengthTrainingTemplateDefinitionSchema,
} from "@fitness-app/application";
import { z } from "zod";
import { type AppSupabaseClient, requireSingleResult, throwOnError } from "./shared";

const dayOfWeekRowSchema = z
  .union([
    z.literal(0),
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
  ])
  .nullable();

const trainingTemplateRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string(),
  template_type: z.enum(["strength", "cardio"]),
  is_archived: z.boolean(),
  definition: z.record(z.unknown()),
  scheduled_day_of_week: dayOfWeekRowSchema,
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

type TrainingTemplateRow = z.infer<typeof trainingTemplateRowSchema>;

function parseDefinition(
  templateType: TrainingTemplateRow["template_type"],
  definition: Record<string, unknown>,
) {
  if (templateType === "cardio") {
    return cardioTrainingTemplateDefinitionSchema.parse(
      definition,
    ) as CardioTrainingTemplateDefinition;
  }

  if (templateType === "strength") {
    return strengthTrainingTemplateDefinitionSchema.parse(definition);
  }

  return definition;
}

export function mapTrainingTemplateRow(row: TrainingTemplateRow): TrainingTemplate {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    templateType: row.template_type,
    isArchived: row.is_archived,
    definition: parseDefinition(row.template_type, row.definition),
    scheduledDayOfWeek: row.scheduled_day_of_week,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export class SupabaseTrainingTemplateRepository
  implements TrainingTemplateRepository
{
  constructor(private readonly client: AppSupabaseClient) {}

  async listActiveCardioTemplates(userId: string) {
    const response = await this.client
      .from("training_templates")
      .select("*")
      .eq("user_id", userId)
      .eq("template_type", "cardio")
      .eq("is_archived", false)
      .is("deleted_at", null)
      .order("name", { ascending: true });

    throwOnError(response.error, "List cardio training templates");

    return trainingTemplateRowSchema
      .array()
      .parse(response.data ?? [])
      .map(mapTrainingTemplateRow);
  }

  async listActiveStrengthTemplates(userId: string) {
    const response = await this.client
      .from("training_templates")
      .select("*")
      .eq("user_id", userId)
      .eq("template_type", "strength")
      .eq("is_archived", false)
      .is("deleted_at", null)
      .order("name", { ascending: true });

    throwOnError(response.error, "List strength training templates");

    return trainingTemplateRowSchema
      .array()
      .parse(response.data ?? [])
      .map(mapTrainingTemplateRow);
  }

  async createStrengthTemplate(input: CreateStrengthTemplateInput) {
    const response = await this.client
      .from("training_templates")
      .insert({
        user_id: input.userId,
        name: input.name,
        template_type: "strength",
        is_archived: false,
        definition: input.definition,
        scheduled_day_of_week: input.scheduledDayOfWeek ?? null,
      })
      .select("*")
      .single();

    const row = requireSingleResult(response, "Create strength training template");
    return mapTrainingTemplateRow(trainingTemplateRowSchema.parse(row));
  }

  async archiveTemplate(userId: string, id: string) {
    const response = await this.client
      .from("training_templates")
      .update({ is_archived: true })
      .eq("id", id)
      .eq("user_id", userId);

    throwOnError(response.error, "Archive training template");
  }

  async setTemplateSchedule(input: SetTemplateScheduleInput) {
    const response = await this.client
      .from("training_templates")
      .update({ scheduled_day_of_week: input.scheduledDayOfWeek })
      .eq("id", input.id)
      .eq("user_id", input.userId)
      .select("*")
      .single();

    const row = requireSingleResult(response, "Set training template schedule");
    return mapTrainingTemplateRow(trainingTemplateRowSchema.parse(row));
  }
}
