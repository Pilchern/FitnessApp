"use client";

import Link from "next/link";
import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Routine } from "@/lib/routines";
import { markHabitDoneAction } from "../actions";
import {
  formatClock,
  formatMinutes,
  positionAt,
  routineTotalSeconds,
  stepStartOffsets,
} from "../helpers";

type RoutinePlayerProps = {
  routine: Routine;
  prepSeconds: number;
  habitId: string | null;
  doneToday: boolean;
};

type WakeLockSentinelLike = { release: () => Promise<void> };

export function RoutinePlayer({
  routine,
  prepSeconds,
  habitId,
  doneToday,
}: RoutinePlayerProps) {
  const { steps } = routine;
  const total = routineTotalSeconds(steps, prepSeconds);
  const offsets = stepStartOffsets(steps, prepSeconds);

  // Elapsed = base + time since startedAt while running; derived on each
  // tick so a locked phone resumes at the right step.
  const [started, setStarted] = useState(false);
  const [base, setBase] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const running = startedAt != null;
  const elapsed = base + (running ? (now - startedAt) / 1000 : 0);
  const position = positionAt(steps, prepSeconds, elapsed);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [running]);

  // Keep the screen on while a routine runs (iOS 16.4+, Android).
  const wakeLock = useRef<WakeLockSentinelLike | null>(null);
  useEffect(() => {
    if (!running) return;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
    };
    const acquire = () => {
      nav.wakeLock
        ?.request("screen")
        .then((lock) => {
          wakeLock.current = lock;
        })
        .catch(() => {});
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") acquire();
    };
    acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      wakeLock.current?.release().catch(() => {});
      wakeLock.current = null;
    };
  }, [running]);

  // A short beep and buzz when a hold starts and when it ends, so the phone
  // can sit on the floor. The audio context is made on the Start tap, which
  // iOS requires.
  const audio = useRef<AudioContext | null>(null);
  const cue = useCallback((pulses: number) => {
    navigator.vibrate?.(pulses > 1 ? [120, 80, 120] : 150);
    const ctx = audio.current;
    if (!ctx) return;
    for (let i = 0; i < pulses; i += 1) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.value = 0.15;
      osc.connect(gain).connect(ctx.destination);
      const at = ctx.currentTime + i * 0.25;
      osc.start(at);
      osc.stop(at + 0.15);
    }
  }, []);
  const phaseKey = position.done
    ? "done"
    : `${position.index}-${position.phase}`;
  const lastPhase = useRef(phaseKey);
  useEffect(() => {
    if (!running || lastPhase.current === phaseKey) return;
    const wasHold = lastPhase.current.endsWith("hold");
    lastPhase.current = phaseKey;
    cue(wasHold ? 2 : 1);
  }, [phaseKey, running, cue]);

  useEffect(() => {
    if (position.done && running) {
      setBase(total);
      setStartedAt(null);
    }
  }, [position.done, running, total]);

  function start() {
    try {
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (Ctx && !audio.current) audio.current = new Ctx();
    } catch {
      // No audio; the screen still shows the countdown.
    }
    setStarted(true);
    setBase(0);
    lastPhase.current = `0-prep`;
    setNow(Date.now());
    setStartedAt(Date.now());
  }

  function jumpTo(offset: number) {
    setBase(Math.max(0, Math.min(offset, total)));
    lastPhase.current = "jump";
    if (running) {
      setNow(Date.now());
      setStartedAt(Date.now());
    }
  }

  function togglePause() {
    if (running) {
      setBase(elapsed);
      setStartedAt(null);
    } else {
      setNow(Date.now());
      setStartedAt(Date.now());
    }
  }

  const [markState, markAction, marking] = useActionState(
    markHabitDoneAction,
    {},
  );

  if (!started) {
    return (
      <div className="space-y-4">
        <section className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-panel sm:p-6">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm text-ink/60">
              {steps.length} steps · about {formatMinutes(total)}
            </p>
            {doneToday ? (
              <span className="text-sm font-semibold text-pine">
                Done today
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-sm leading-6 text-ink/80">
            {routine.summary}
          </p>
          <ul className="mt-3 space-y-1.5 text-sm leading-6 text-ink/70">
            {routine.safety.map((rule) => (
              <li key={rule} className="flex gap-2">
                <span aria-hidden="true" className="text-ember">
                  •
                </span>
                {rule}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={start}
            className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-pine text-base font-semibold text-white transition hover:bg-pine/90"
          >
            Start
          </button>
        </section>

        <section className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-panel sm:p-6">
          <h2 className="font-display text-lg text-ink">Steps</h2>
          <ol className="mt-2 divide-y divide-ink/10">
            {steps.map((step, i) => (
              <li
                key={`${step.name}-${i}`}
                className="flex items-baseline justify-between gap-3 py-2.5 text-sm"
              >
                <span className="text-ink">{step.name}</span>
                <span className="shrink-0 text-ink/55">{step.seconds}s</span>
              </li>
            ))}
          </ol>
          <details className="mt-3 text-sm text-ink/65">
            <summary className="cursor-pointer font-medium">
              Waiting on PT clearance
            </summary>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {routine.afterClearance.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </details>
        </section>
      </div>
    );
  }

  if (position.done) {
    return (
      <section className="rounded-[1.75rem] border border-ink/10 bg-white p-6 text-center shadow-panel">
        <p className="text-sm text-ink/60">{formatMinutes(total)}</p>
        <h2 className="mt-1 font-display text-2xl text-ink">
          {routine.title} done
        </h2>
        {markState.error ? (
          <p role="alert" className="mt-3 text-sm text-ember">
            {markState.error}
          </p>
        ) : null}
        <div className="mt-5 space-y-3">
          {habitId && !doneToday ? (
            <form action={markAction}>
              <input type="hidden" name="habitId" value={habitId} />
              <button
                type="submit"
                disabled={marking}
                className="inline-flex h-12 w-full items-center justify-center rounded-full bg-pine text-base font-semibold text-white disabled:bg-pine/60"
              >
                {marking ? "Saving..." : "Mark done for today"}
              </button>
            </form>
          ) : (
            <Link
              href="/dashboard"
              className="inline-flex h-12 w-full items-center justify-center rounded-full bg-pine text-base font-semibold text-white"
            >
              Back to dashboard
            </Link>
          )}
          <button
            type="button"
            onClick={start}
            className="text-sm font-semibold text-ink/60 hover:text-ink"
          >
            Run it again
          </button>
        </div>
      </section>
    );
  }

  const step = steps[position.index]!;
  const next = steps[position.index + 1] ?? null;
  const stepOffset = offsets[position.index]!;
  const inPrep = position.phase === "prep";

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-panel sm:p-6">
      <div className="h-1.5 overflow-hidden rounded-full bg-ink/10">
        <div
          className="h-full rounded-full bg-pine transition-[width] duration-300"
          style={{ width: `${Math.min(100, (elapsed / total) * 100)}%` }}
        />
      </div>
      <p className="mt-3 text-sm text-ink/55">
        Step {position.index + 1} of {steps.length}
        {!running ? " · Paused" : ""}
      </p>

      <p
        className={`mt-4 text-xs font-semibold uppercase tracking-[0.2em] ${inPrep ? "text-ember" : "text-pine"}`}
      >
        {inPrep ? "Get ready" : "Hold"}
      </p>
      <h2 className="mt-1 font-display text-2xl leading-tight text-ink">
        {step.name}
      </h2>
      <div
        className="mt-4 text-center font-semibold tabular-nums text-ink"
        style={{ fontSize: "5.5rem", lineHeight: 1 }}
        aria-live="off"
      >
        {formatClock(position.remaining)}
      </div>
      <p className="mt-4 min-h-[4.5rem] text-base leading-7 text-ink/80">
        {step.cue}
      </p>
      {next ? (
        <p className="mt-2 text-sm text-ink/50">Next: {next.name}</p>
      ) : null}

      <div className="mt-6 grid grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => {
            const intoStep = elapsed - stepOffset;
            const target =
              intoStep > prepSeconds + 3 || position.index === 0
                ? stepOffset
                : offsets[position.index - 1]!;
            jumpTo(target);
          }}
          className="h-12 rounded-full border border-ink/15 text-sm font-semibold text-ink"
        >
          Back
        </button>
        <button
          type="button"
          onClick={togglePause}
          className="h-12 rounded-full bg-ink text-sm font-semibold text-white"
        >
          {running ? "Pause" : "Resume"}
        </button>
        <button
          type="button"
          onClick={() =>
            jumpTo(
              inPrep
                ? stepOffset + prepSeconds
                : (offsets[position.index + 1] ?? total),
            )
          }
          className="h-12 rounded-full border border-ink/15 text-sm font-semibold text-ink"
        >
          {inPrep ? "Skip prep" : "Next"}
        </button>
      </div>
      <button
        type="button"
        onClick={() => {
          setStarted(false);
          setStartedAt(null);
          setBase(0);
        }}
        className="mt-4 w-full text-center text-sm text-ink/50 hover:text-ink"
      >
        End routine
      </button>
    </section>
  );
}
