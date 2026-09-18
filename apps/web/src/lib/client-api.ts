"use client";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const TOKEN_KEY = "takar.token";
const USER_KEY = "takar.user";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "OWNER" | "STAFF";
};

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getSessionUser(): SessionUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

export function saveSession(token: string, user: SessionUser) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // Sesi tetap jalan sampai tab ditutup walau storage diblokir.
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // tidak apa-apa
  }
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Fetch ke API. Token dilampirkan otomatis kalau ada. */
export async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = getToken();

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...init.headers,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    let message = `Request gagal (${res.status})`;
    let code: string | undefined;
    let details: unknown;

    try {
      const payload = (await res.json()) as {
        error?: { message?: string; code?: string; details?: unknown };
      };
      message = payload.error?.message ?? message;
      code = payload.error?.code;
      details = payload.error?.details;
    } catch {
      // Backend mati atau balas bukan JSON.
    }

    throw new ApiError(res.status, message, code, details);
  }

  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const formatRupiah = (value: string | number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value));

export const formatWaktu = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
