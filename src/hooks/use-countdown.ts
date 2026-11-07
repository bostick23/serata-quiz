"use client";

import { useCallback, useSyncExternalStore } from "react";
import { msUntilNextTick, secondsLeft } from "@/lib/countdown";

/**
 * Seconds left until `deadline` (local clock). Re-renders the caller once per
 * displayed second, not on a fast interval: the game pages are large trees and
 * re-rendering them 10x/s was wasting CPU and battery on players' phones.
 */
export function useCountdown(deadline: number | null) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!deadline) return () => {};
      let timer: ReturnType<typeof setTimeout> | undefined;
      const schedule = () => {
        const wait = msUntilNextTick(deadline, Date.now());
        if (wait === null) return;
        timer = setTimeout(() => {
          onChange();
          schedule();
        }, wait);
      };
      schedule();
      return () => clearTimeout(timer);
    },
    [deadline],
  );

  const seconds = useSyncExternalStore(
    subscribe,
    () => secondsLeft(deadline, Date.now()),
    () => 0,
  );

  return { seconds };
}
