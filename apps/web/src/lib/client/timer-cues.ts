"use client";

import { useCallback, useEffect, useRef } from "react";

type WakeLockSentinelLike = { release: () => Promise<void> };
type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
};

/**
 * Keeps the screen on while `active` (iOS 16.4+, Android). The browser drops
 * the lock when the page is hidden, so it is taken again on return. Released
 * when `active` goes false or the component unmounts.
 */
export function useScreenWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const nav = navigator as WakeLockNavigator;
    let lock: WakeLockSentinelLike | null = null;
    let cancelled = false;
    const acquire = () => {
      nav.wakeLock
        ?.request("screen")
        .then((next) => {
          // Released before the request came back: let it go at once.
          if (cancelled) next.release().catch(() => {});
          else lock = next;
        })
        .catch(() => {});
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") acquire();
    };
    acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
      lock = null;
    };
  }, [active]);
}

/**
 * A short 880 Hz beep through Web Audio. iOS only plays audio from a context
 * made or resumed in a tap, so call `unlock` from a click handler first;
 * `beep` is silent until then. iOS's silent switch also mutes it.
 */
export function useBeep() {
  const audio = useRef<AudioContext | null>(null);

  useEffect(
    () => () => {
      audio.current?.close().catch(() => {});
      audio.current = null;
    },
    [],
  );

  const unlock = useCallback(() => {
    try {
      if (!audio.current) {
        const Ctx =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (Ctx) audio.current = new Ctx();
      }
      // iOS suspends an idle context (e.g. after the phone locks).
      if (audio.current?.state === "suspended") {
        audio.current.resume().catch(() => {});
      }
    } catch {
      // No audio; the screen still shows the countdown.
    }
  }, []);

  const beep = useCallback((pulses = 1) => {
    const ctx = audio.current;
    if (!ctx) return;
    try {
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
    } catch {
      // A closed or broken context: skip the sound.
    }
  }, []);

  return { unlock, beep };
}
