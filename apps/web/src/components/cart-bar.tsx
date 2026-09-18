"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Select } from "@/components/select";
import { useCart } from "@/lib/cart";
import { ApiError, formatRupiah, request } from "@/lib/client-api";
import { simpanPesananTerakhir } from "@/lib/last-order";
import { useMeja } from "@/lib/meja";
import { useApi } from "@/lib/use-api";

type CafeTable = { id: string; number: string };

/**
 * Keranjang hidup di layout, bukan di halaman menu, supaya pelanggan bisa
 * menambah dari kartu maupun dari halaman detail tanpa kehilangan isinya.
 */
export function CartBar() {
  const router = useRouter();
  const cart = useCart();
  const { data: tables } = useApi<CafeTable[]>("/api/tables");

  const meja = useMeja();

  const [open, setOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("keydown", onKey);
    dialogRef.current?.focus();

    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  async function kirimPesanan() {
    setSending(true);
    setError(null);

    try {
      const order = await request<{ code: string }>("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          ...(meja.nilai && { tableId: meja.nilai }),
          ...(customerName.trim() && { customerName: customerName.trim() }),
          ...(note.trim() && { note: note.trim() }),
          items: cart.items.map((i) => ({
            menuId: i.menuId,
            qty: i.qty,
            ...(i.note?.trim() && { note: i.note.trim() }),
          })),
        }),
      });

      cart.clear();
      simpanPesananTerakhir(order.code);
      setOpen(false);
      router.push(`/pesanan/${order.code}`);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Pesanan gagal dikirim, coba lagi",
      );
      setSending(false);
    }
  }

  if (cart.count === 0) return null;

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="text-sm">
            <p className="font-medium">
              {cart.count} item · {formatRupiah(cart.total)}
            </p>
            <p className="text-muted">Bayar di kasir setelah pesanan siap</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-ink"
          >
            Lihat keranjang
          </button>
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-30 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Keranjang pesanan"
            tabIndex={-1}
            className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-surface p-5 sm:rounded-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <h2 className="font-display text-xl font-semibold">
                Pesanan kamu
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-1 text-sm text-muted hover:text-ink"
              >
                Tutup
              </button>
            </div>

            {/* Catatan ditaruh di tiap menu, bukan hanya satu untuk seluruh
                pesanan: "es sedikit" berlaku untuk satu gelas tertentu, dan
                barista perlu tahu gelas yang mana. */}
            <ul className="mt-4 space-y-4">
              {cart.items.map((item) => (
                <li key={item.menuId}>
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted">
                        {formatRupiah(item.price)} × {item.qty}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => cart.setQty(item.menuId, item.qty - 1)}
                        aria-label={`Kurangi ${item.name}`}
                        className="size-8 rounded-lg border border-border text-lg leading-none hover:bg-sunk"
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-sm tabular-nums">
                        {item.qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => cart.setQty(item.menuId, item.qty + 1)}
                        aria-label={`Tambah ${item.name}`}
                        className="size-8 rounded-lg border border-border text-lg leading-none hover:bg-sunk"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <input
                    value={item.note ?? ""}
                    onChange={(e) => cart.setNote(item.menuId, e.target.value)}
                    placeholder={`Catatan untuk ${item.name}`}
                    aria-label={`Catatan untuk ${item.name}`}
                    className="mt-2 w-full rounded-lg border border-border bg-paper px-3 py-1.5 text-sm"
                  />
                </li>
              ))}
            </ul>

            <div className="mt-5 space-y-3 border-t border-border pt-4">
              <label className="block text-sm">
                <span className="text-muted">Nomor meja</span>
                <span className="mt-1 block">
                  <Select
                    value={meja.nilai ?? ""}
                    onChange={(e) => meja.pilih(e.target.value || null)}
                  >
                    <option value="">Bawa pulang / ambil sendiri</option>
                    {(tables ?? []).map((t) => (
                      <option key={t.id} value={t.id}>
                        Meja {t.number}
                      </option>
                    ))}
                  </Select>
                </span>
              </label>

              <label className="block text-sm">
                <span className="text-muted">Nama (opsional)</span>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Dipanggil saat pesanan siap"
                  className="mt-1 w-full rounded-xl border border-border bg-paper px-3 py-2.5"
                />
              </label>

              <label className="block text-sm">
                <span className="text-muted">
                  Catatan untuk seluruh pesanan (opsional)
                </span>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Contoh: antar semua sekaligus"
                  className="mt-1 w-full rounded-xl border border-border bg-paper px-3 py-2.5"
                />
              </label>
            </div>

            {error && <p className="mt-4 text-sm text-accent-ink">{error}</p>}

            <div className="mt-5 flex items-center justify-between gap-3">
              <div className="text-sm">
                <p className="text-muted">Total</p>
                <p className="font-display text-xl font-semibold">
                  {formatRupiah(cart.total)}
                </p>
              </div>
              <button
                type="button"
                onClick={kirimPesanan}
                disabled={sending}
                className="rounded-xl bg-accent px-5 py-2.5 font-medium text-white hover:bg-accent-ink disabled:opacity-50"
              >
                {sending ? "Mengirim…" : "Kirim ke dapur"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
