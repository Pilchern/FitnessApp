import type { SparseTrendPoint } from "@fitness-app/application";

type TrendChartProps = {
  title: string;
  description: string;
  points: SparseTrendPoint[];
  formatValue: (value: number) => string;
  emptyMessage: string;
  strokeClassName?: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function buildDeltaLabel(
  points: SparseTrendPoint[],
  formatValue: (value: number) => string,
) {
  if (points.length < 2) {
    return "Need at least 2 points for a trend";
  }

  const delta = Math.round((points[points.length - 1].value - points[0].value) * 10) / 10;
  const prefix = delta > 0 ? "+" : "";
  return `${prefix}${formatValue(delta)}`;
}

export function TrendChart({
  title,
  description,
  points,
  formatValue,
  emptyMessage,
  strokeClassName = "stroke-pine",
}: TrendChartProps) {
  const chartWidth = 320;
  const chartHeight = 176;
  const padding = { top: 20, right: 12, bottom: 28, left: 12 };
  const latest = points[points.length - 1] ?? null;
  const first = points[0] ?? null;

  if (points.length === 0) {
    return (
      <article className="rounded-[1.5rem] border border-dashed border-ink/15 bg-white/65 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-ink">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-ink/70">{description}</p>
          </div>
          <div className="rounded-full border border-ink/10 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-ink/60">
            No data
          </div>
        </div>
        <p className="mt-6 text-sm leading-6 text-ink/70">{emptyMessage}</p>
      </article>
    );
  }

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const drawableWidth = chartWidth - padding.left - padding.right;
  const drawableHeight = chartHeight - padding.top - padding.bottom;

  const coordinates = points.map((point, index) => {
    const x =
      points.length === 1
        ? chartWidth / 2
        : padding.left + (drawableWidth * index) / (points.length - 1);
    const normalized = range === 0 ? 0.5 : (point.value - min) / range;
    const y = padding.top + drawableHeight - normalized * drawableHeight;
    return {
      ...point,
      x,
      y,
    };
  });

  const linePath = coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  return (
    <article className="rounded-[1.5rem] border border-ink/10 bg-white/75 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-ink">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-ink/70">{description}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold text-ink">
            {latest ? formatValue(latest.value) : "--"}
          </div>
          <div className="mt-1 text-xs uppercase tracking-[0.16em] text-ink/60">
            {buildDeltaLabel(points, formatValue)}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-[1.25rem] border border-ink/10 bg-sand/45 p-4">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="h-44 w-full"
          role="img"
          aria-label={`${title} trend chart`}
        >
          <line
            x1={padding.left}
            x2={chartWidth - padding.right}
            y1={chartHeight - padding.bottom}
            y2={chartHeight - padding.bottom}
            className="stroke-ink/15"
            strokeWidth="1"
          />

          <path
            d={linePath}
            className={strokeClassName}
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {coordinates.map((point) => (
            <circle
              key={`${point.date}-${point.value}`}
              cx={point.x}
              cy={point.y}
              r="4"
              className={strokeClassName}
              fill="white"
              strokeWidth="2.5"
            />
          ))}
        </svg>

        <div className="mt-3 flex items-center justify-between gap-4 text-xs uppercase tracking-[0.16em] text-ink/60">
          <span>{first ? formatDate(first.date) : "--"}</span>
          <span>{latest ? formatDate(latest.date) : "--"}</span>
        </div>
      </div>
    </article>
  );
}
