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

/** How late the "rest over" beep may still play. */
export const REST_BEEP_GRACE_MS = 30_000;

/**
 * The rest ended recently enough to beep. A tick that lands minutes late
 * (phone locked, app in the background) should not beep out of nowhere.
 */
export function restBeepFresh(endsAt: number | null, now: number): boolean {
  return endsAt != null && now - endsAt <= REST_BEEP_GRACE_MS;
}
