"use client";

import { IconMeja } from "@/components/icons";
import { useMeja } from "@/lib/meja";
import { useApi } from "@/lib/use-api";

type CafeTable = { id: string; number: string };

/**
 * Penegasan meja mana yang sedang dipakai.
 *
 * Muncul di halaman menu supaya pelanggan yang baru memindai QR tahu nomornya
 * sudah terbaca, dan yang salah meja bisa langsung melepasnya.
 */
export function MejaTerpilih() {
  const meja = useMeja();
  const { data: tables } = useApi<CafeTable[]>("/api/tables");

  if (!meja.nilai) return null;

  const nomor = tables?.find((t) => t.id === meja.nilai)?.number;
  if (!nomor) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-accent-soft px-4 py-2.5">
      <IconMeja className="size-4 text-accent-ink" />
      <p className="text-sm text-accent-ink">
        Pesanan kamu akan ditandai <strong>Meja {nomor}</strong>
      </p>
      <button
        type="button"
        onClick={() => meja.pilih(null)}
        className="ml-auto rounded-lg px-2 py-1 text-sm text-accent-ink underline underline-offset-2"
      >
        Bukan meja ini
      </button>
    </div>
  );
}
