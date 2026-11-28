"use client";

import { useLayoutEffect, useRef, useState } from "react";

/** Use in a component keyed by its filter snapshot so old results cannot cross scopes. */
export function useAiRequest() {
  const active = useRef(false);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  useLayoutEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  async function run<T>(request: () => Promise<T>, accept: (result: T) => void) {
    if (pending.current || !active.current) return;
    pending.current = true;
    setBusy(true);
    setElapsed(0);
    setError(null);
    const timer = window.setInterval(() => setElapsed((v) => v + 1), 1000);
    try {
      const result = await request();
      if (active.current) accept(result);
    } catch (cause) {
      if (active.current) setError(cause instanceof Error ? cause.message : "AI request failed");
    } finally {
      window.clearInterval(timer);
      pending.current = false;
      if (active.current) setBusy(false);
    }
  }
  return { run, busy, elapsed, error, dismiss: () => setError(null) };
}

export interface AiScope {
  label: string;
  timeZone: string;
}
