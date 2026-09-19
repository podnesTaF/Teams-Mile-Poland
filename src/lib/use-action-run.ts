"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * `useTransition` stand-in for islands that call a server action and then
 * `router.refresh()` or `router.push()`.
 *
 * With `useTransition`, `pending` stays true until everything the callback
 * scheduled has committed — the action *and* the whole server re-render behind
 * the refresh or navigation. When that re-render is slow, or its response never
 * arrives (dev server restarted, connection dropped mid-stream), the button
 * spins forever even though the action itself already succeeded. And a thrown
 * action rejects the transition with nobody catching it.
 *
 * Here `pending` covers exactly the awaited callback: it ends once the action
 * has answered and the follow-up has been *dispatched*, and a throw reaches
 * `onError` instead of nowhere. Same tuple shape as `useTransition`, so a call
 * site changes one line.
 */
export function useActionRun(onError: (error: unknown) => void) {
  const [pending, setPending] = useState(false);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  });

  const run = useCallback((callback: () => Promise<void>) => {
    setPending(true);
    callback()
      .catch((error: unknown) => {
        console.error("[action] failed", error);
        onErrorRef.current(error);
      })
      .finally(() => setPending(false));
  }, []);

  return [pending, run] as const;
}
