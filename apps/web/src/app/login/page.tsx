"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ApiError,
  request,
  saveSession,
  type SessionUser,
} from "@/lib/client-api";
import { notifySessionChanged } from "@/lib/session";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await request<{ token: string; user: SessionUser }>(
        "/api/auth/login",
        { method: "POST", body: JSON.stringify({ email, password }) },
      );

      saveSession(res.token, res.user);
      notifySessionChanged();
      router.push("/dashboard/pesanan");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal masuk, coba lagi");
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
      <Link href="/" className="text-sm text-muted">
        ← Kembali ke menu
      </Link>

      <h1 className="mt-6 text-2xl font-semibold tracking-tight">Masuk</h1>
      <p className="mt-1 text-muted">Khusus pemilik dan barista.</p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block text-sm">
          <span className="text-muted">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          <span className="text-muted">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2"
          />
        </label>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-accent px-4 py-2.5 font-medium text-white disabled:opacity-50"
        >
          {loading ? "Memeriksa…" : "Masuk"}
        </button>
      </form>

      <div className="mt-8 rounded-lg border border-border bg-surface p-4 text-sm text-muted">
        <p className="font-medium text-ink">Akun contoh</p>
        <p className="mt-1 font-mono text-xs">owner@takar.test / takar1234</p>
        <p className="font-mono text-xs">staff@takar.test / takar1234</p>
      </div>
    </main>
  );
}
