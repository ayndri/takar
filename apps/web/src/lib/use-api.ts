"use client";

import useSWR, { type SWRConfiguration } from "swr";
import { request } from "./client-api";

/**
 * Pembungkus tipis di atas SWR supaya halaman dashboard tidak perlu
 * useState + useEffect sendiri-sendiri untuk memuat data.
 *
 * Kunci SWR-nya adalah path API, jadi dua halaman yang membaca endpoint sama
 * ikut menumpang cache yang sama.
 */
export function useApi<T>(path: string | null, options?: SWRConfiguration<T>) {
  const { data, error, isLoading, mutate } = useSWR<T>(
    path,
    (key: string) => request<T>(key),
    {
      revalidateOnFocus: false,
      ...options,
    },
  );

  return { data, error: error as Error | undefined, isLoading, mutate };
}
