"use client";

import { startTransition, useCallback, useEffect, useState } from "react";
import { acquireJson } from "./api-request";
import { useToast } from "@/components/ui/toast";

export interface ApiState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  refresh: () => void;
}

/** Deduplicate concurrent reads and cancel requests when their last consumer leaves. */
export const useApi = <T>(url: string | null): ApiState<T> => {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(url));
  const [tick, setTick] = useState(0);
  const [dataUrl, setDataUrl] = useState(url);

  useEffect(() => {
    if (!url) {
      setData(null);
      setError(null);
      setLoading(false);
      setDataUrl(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const request = acquireJson<T>(url);
    request.promise
      .then((body) => {
        if (cancelled) return;
        // Render fresh data as a transition so React yields to the browser mid-render
        // instead of blocking the main thread for the whole page.
        startTransition(() => {
          setData(body);
          setDataUrl(url);
          setError(null);
          setLoading(false);
        });
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Network error");
          setData(null);
          setDataUrl(url);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
      request.release();
    };
  }, [url, tick]);

  // Saat privacy mode di-toggle (OFF→ON atau sebaliknya), segera refetch semua
  // data agar angka P&L, trade, dan lainnya langsung disembunyikan/tampilkan
  // tanpa harus merefresh halaman.
  useEffect(() => {
    if (!url) return;
    const onPrivacyToggle = () => setTick((v) => v + 1);
    window.addEventListener("privacy-toggled", onPrivacyToggle);
    return () => window.removeEventListener("privacy-toggled", onPrivacyToggle);
  }, [url]);

  const refresh = useCallback(() => setTick((value) => value + 1), []);
  const current = dataUrl === url;
  return {
    data: current ? data : null,
    error: current ? error : null,
    loading: Boolean(url) && (!current || loading),
    refresh,
  };
};

export const postJson = async <T = unknown>(
  url: string,
  body: unknown,
  method: "POST" | "PATCH" | "PUT" | "DELETE" = "POST",
): Promise<T> => {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`);
  return data;
};

/**
 * Hook untuk operasi mutasi (POST/PATCH/PUT/DELETE) dengan:
 *   - loading state yang dapat ditampilkan di UI
 *   - toast sukses/gagal otomatis
 *   - optional onSuccess callback
 *
 * Contoh:
 *   const { mutate, loading } = useMutation({
 *     url: "/api/cfd-journal",
 *     successTitle: "Trade tersimpan",
 *     errorTitle: "Gagal menyimpan trade",
 *   });
 *   await mutate({ body: formData });
 */
export function useMutation({
  url,
  method = "POST",
  successTitle,
  errorTitle,
  onSuccess,
}: {
  url: string;
  method?: "POST" | "PATCH" | "PUT" | "DELETE";
  successTitle?: string;
  errorTitle?: string;
  onSuccess?: (data: unknown) => void;
}) {
  const [loading, setLoading] = useState(false);
  const { show } = useToast();

  const mutate = async (
    body: unknown,
    opts?: { successTitle?: string; errorTitle?: string },
  ): Promise<unknown> => {
    setLoading(true);
    try {
      const data = await postJson(url, body, method);
      if (onSuccess) onSuccess(data);
      show({
        title: opts?.successTitle ?? successTitle ?? "Berhasil disimpan.",
        variant: "success",
      });
      return data;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Terjadi kesalahan saat menyimpan.";
      show({
        title: opts?.errorTitle ?? errorTitle ?? "Gagal menyimpan data.",
        description: message,
        variant: "destructive",
      });
      throw cause;
    } finally {
      setLoading(false);
    }
  };

  return { mutate, loading };
}

/**
 * Hook untuk operasi DELETE yang menganalisis respon dan menampilkan toast.
 */
export function useDelete({
  url,
  successTitle,
  errorTitle,
  onSuccess,
}: {
  url: string;
  successTitle?: string;
  errorTitle?: string;
  onSuccess?: (data: unknown) => void;
}) {
  return useMutation({ url, method: "DELETE", successTitle, errorTitle, onSuccess });
}
