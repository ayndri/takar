"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LacakPesananPage() {
  const router = useRouter();
  const [kode, setKode] = useState("");

  return (
    <main className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        Lacak pesanan
      </h1>
      <p className="mt-2 text-muted">
        Masukkan kode yang muncul setelah kamu mengirim pesanan. Bentuknya
        seperti <span className="font-mono text-ink">TKR-7F2A</span>.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const bersih = kode.trim().toUpperCase();
          if (bersih) router.push(`/pesanan/${bersih}`);
        }}
        className="mt-6 flex gap-2"
      >
        <input
          value={kode}
          onChange={(e) => setKode(e.target.value)}
          placeholder="TKR-0000"
          aria-label="Kode pesanan"
          className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-4 py-3 font-mono tracking-wide uppercase"
        />
        <button
          type="submit"
          disabled={kode.trim().length < 4}
          className="rounded-xl bg-accent px-5 py-3 font-medium text-white hover:bg-accent-ink disabled:opacity-50"
        >
          Cari
        </button>
      </form>
    </main>
  );
}
