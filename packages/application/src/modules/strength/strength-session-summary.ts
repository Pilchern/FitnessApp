import { z } from "zod";
import { dateRangeQuerySchema } from "../../shared/primitives";

export const strengthSessionDateRangeQuerySchema = dateRangeQuerySchema;

export type StrengthSessionDateRangeQuery = z.infer<
  typeof strengthSessionDateRangeQuerySchema
>;

export interface StrengthSessionSummaryRepository {
  countCompletedByDateRange(query: StrengthSessionDateRangeQuery): Promise<number>;
}

export class StrengthSessionSummaryService {
  constructor(private readonly repository: StrengthSessionSummaryRepository) {}

  async countCompletedByDateRange(input: unknown) {
    return this.repository.countCompletedByDateRange(
      strengthSessionDateRangeQuerySchema.parse(input),
    );
  }
}
