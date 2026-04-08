import { describe, expect, it } from "vitest";
import { WithingsBodyMetricsAdapter } from "./withings-adapter";

const adapter = new WithingsBodyMetricsAdapter({
  clientId: "client-id",
  clientSecret: "client-secret",
  redirectUri: "http://localhost:3000/api/integrations/withings/callback",
});

describe("WithingsBodyMetricsAdapter", () => {
  it("maps supported body metric measures into a canonical import shape", () => {
    const mapped = adapter.mapRawBodyMetricItem(
      {
        providerEventType: "measure_group",
        providerExternalId: "12345",
        occurredAt: "2026-04-01T12:00:00.000Z",
        payload: {
          grpid: 12345,
          date: 1711972800,
          measures: [
            { type: 1, value: 85000, unit: -3 },
            { type: 6, value: 1840, unit: -2 },
            { type: 76, value: 65500, unit: -3 },
          ],
        },
      },
      {
        importBatchId: "00000000-0000-0000-0000-000000000001",
        rawImportEventId: "00000000-0000-0000-0000-000000000002",
      },
    );

    expect(mapped).toMatchObject({
      measuredOn: "2024-04-01",
      weightKg: 85,
      bodyFatPct: 18.4,
      muscleMassKg: 65.5,
      providerExternalId: "12345",
    });
  });

  it("skips unsupported measure groups", () => {
    const mapped = adapter.mapRawBodyMetricItem(
      {
        providerEventType: "measure_group",
        providerExternalId: "12346",
        occurredAt: "2026-04-01T12:00:00.000Z",
        payload: {
          grpid: 12346,
          date: 1711972800,
          measures: [{ type: 4, value: 1700, unit: -2 }],
        },
      },
      {
        importBatchId: "00000000-0000-0000-0000-000000000001",
        rawImportEventId: "00000000-0000-0000-0000-000000000002",
      },
    );

    expect(mapped).toBeNull();
  });
});
