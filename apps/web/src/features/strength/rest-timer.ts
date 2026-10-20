/** Whole seconds left on a rest that ends at `endsAt`; 0 when none or over. */
export function restSecondsLeft(endsAt: number | null, now: number): number {
  if (endsAt == null) return 0;
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

/** A rest is running: started and not yet over. Holds the wake lock. */
export function restRunning(endsAt: number | null, now: number): boolean {
  return restSecondsLeft(endsAt, now) > 0;
}

/**
 * The rest just ran out and the "rest over" cue has not fired yet, so beep and
 * buzz now. `cued` is reset each time a rest starts.
 */
export function restEndDue(
  endsAt: number | null,
  now: number,
  cued: boolean,
): boolean {
  return endsAt != null && !cued && restSecondsLeft(endsAt, now) === 0;
}
