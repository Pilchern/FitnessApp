import type { IsoDate } from "@fitness-app/domain";

export type SparseTrendPoint = {
  date: IsoDate;
  value: number;
};

export function buildSparseTrendSeries<T>(
  items: T[],
  getDate: (item: T) => IsoDate,
  getValue: (item: T) => number | null | undefined,
): SparseTrendPoint[] {
  return [...items]
    .map((item) => ({
      date: getDate(item),
      value: getValue(item),
    }))
    .filter((item): item is SparseTrendPoint => item.value != null)
    .sort((left, right) => left.date.localeCompare(right.date));
}
