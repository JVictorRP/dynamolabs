export const PERIODS = { "7d": 7, "30d": 30, "90d": 90 } as const;
export type Period = keyof typeof PERIODS;

export function parsePeriod(value: string | string[] | undefined): Period {
  return typeof value === "string" && value in PERIODS ? (value as Period) : "30d";
}

export function periodStart(period: Period) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - PERIODS[period] + 1);
  return d;
}

export const toDay = (d: Date) => d.toISOString().slice(0, 10);
