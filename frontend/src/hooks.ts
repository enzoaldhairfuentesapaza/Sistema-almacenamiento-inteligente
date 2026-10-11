import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, problem } from "./api";
import type { Row } from "./api";
export function useList(path: string | null) {
  const [rows, setRows] = useState<Row[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((n) => n + 1), []);
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    Promise.resolve().then(() => {
      if (!controller.signal.aborted) {
        setLoading(true);
        setError("");
      }
    });
    api<Row[]>(path, { signal: controller.signal })
      .then((rows) => {
        if (!controller.signal.aborted) setRows(rows);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [path, revision]);
  return { rows, loading, error, reload };
}
export function useSubmit() {
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent, action: () => Promise<void>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } catch (err) {
      problem(err);
    } finally {
      setBusy(false);
    }
  }
  return { busy, submit };
}

export function useResource<T>(path: string | null) {
  const [result, setResult] = useState<{
    path: string | null;
    data: T | null;
    error: string;
  }>({ path: null, data: null, error: "" });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    api<T>(path, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setResult({ path, data, error: "" });
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setResult({ path, data: null, error: e.message });
      });
    return () => controller.abort();
  }, [path, revision]);
  return {
    data: result.path === path ? result.data : null,
    error: result.path === path ? result.error : "",
    loading:
      !!path && (result.path !== path || (!result.data && !result.error)),
    reload: () => setRevision((v) => v + 1),
  };
}
