"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useApi<T>(fetcher: (token: string) => Promise<T>, deps: unknown[] = []): UseApiResult<T> {
  const { getToken, isLoaded } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!isLoaded) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    getToken()
      .then((token) => {
        if (!token) {
          // Session expired — redirect to sign-in
          window.location.href = "/sign-in";
          return;
        }
        return fetcher(token);
      })
      .then((result) => {
        if (!cancelled && result !== undefined) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, tick, ...deps]);

  return { data, loading, error, refetch };
}
