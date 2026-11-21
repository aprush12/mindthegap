import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribe } from './index';

/** Runs an async data-layer call and re-runs it whenever the store changes. */
export function useQuery<T>(fn: () => Promise<T>, deps: unknown[] = []): { data: T | undefined; loading: boolean; error?: Error; reload: () => void } {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<Error>();
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const run = useCallback(() => {
    let live = true;
    fnRef.current().then(
      (v) => live && (setData(v), setError(undefined), setLoading(false)),
      (e) => live && (setError(e instanceof Error ? e : new Error(String(e))), setLoading(false)),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    const cancel = run();
    const unsub = subscribe(() => run());
    return () => {
      cancel();
      unsub();
    };
  }, [run]);
  return { data, loading, error, reload: run };
}
