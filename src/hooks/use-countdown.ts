"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export function useCountdown(deadline: number | null) {
  const [remaining, setRemaining] = useState<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!deadline) {
      setRemaining(0);
      return;
    }

    const update = () => {
      const diff = Math.max(0, deadline - Date.now());
      setRemaining(diff);
      if (diff <= 0 && intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };

    update();
    intervalRef.current = setInterval(update, 100);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [deadline]);

  const seconds = Math.ceil(remaining / 1000);
  const fraction = deadline ? remaining / (deadline - (deadline - 10000)) : 0;

  return { remaining, seconds, fraction };
}
