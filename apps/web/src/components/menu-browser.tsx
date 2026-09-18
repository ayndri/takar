"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCart } from "@/lib/cart";
import { ApiError, formatRupiah, request } from "@/lib/client-api";
import type { PublicMenu } from "@/lib/api";

/** Di bawah angka ini pelanggan diberi tahu sisanya, supaya tidak kecewa di akhir. */
const AMBANG_MENIPIS = 5;

type CafeTable = { id: string; number: string };

export function MenuBrowser({
  menus,
  tables,
}: {
  menus: PublicMenu[];
  tables: CafeTable[];
}) {
  const router = useRouter();
  const cart = useCart();

  const [open, setOpen] = useState(false);
  const [tableId, setTableId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = [...new Set(menus.map((m) => m.category))];

  async function kirimPesanan() {
    setSending(true);
    setError(null);

    try {
      const order = await request<{ code: string }>("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          ...(tableId && { tableId }),
          ...(customerName.trim() && { customerName: customerName.trim() }),
          ...(note.trim() && { note: note.trim() }),
          items: cart.items.map((i) => ({ menuId: i.menuId, qty: i.qty })),
        }),
      });

      cart.clear();
      router.push(`/pesanan/${order.code}`);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Pesanan gagal dikirim, coba lagi",
      );
      setSending(false);
    }
  }

  return (
    <>
      <div className="space-y-10 pb-28">
        {categories.map((category) => (
          <section key={category}>
            <h2 className="mb-4 text-sm font-semibold tracking-wide text-muted uppercase">
              {category}
            </h2>

            <ul className="grid gap-3 sm:grid-cols-2">
              {menus
                .filter((m) => m.category === category)
                .map((menu) => {
                  const inCart =
                    cart.items.find((i) => i.menuId === menu.id)?.qty ?? 0;

                  return (
                    <li
                      key={menu.id}
                      className={`rounded-xl border border-border bg-surface p-4 transition ${
                        menu.available ? "hover:border-accent" : "opacity-60"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-medium">{menu.name}</h3>
                          <p className="mt-0.5 text-sm text-muted">
                            {formatRupiah(menu.price)}
                          </p>
                        </div>

                        {!menu.available ? (
                          <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-danger">
                            Habis
                          </span>
                        ) : inCart > 0 ? (
                          <div className="flex shrink-0 items-center gap-2">
                            <button
                              type="button"
                              onClick={() => cart.setQty(menu.id, inCart - 1)}
                              aria-label={`Kurangi ${menu.name}`}
                              className="size-8 rounded-lg border border-border text-lg leading-none"
                            >
                              −
                            </button>
                            <span className="w-5 text-center text-sm font-medium tabular-nums">
                              {inCart}
                            </span>
                            <button
                              type="button"
                              onClick={() => cart.setQty(menu.id, inCart + 1)}
                              disabled={inCart >= menu.remainingPortions}
                              aria-label={`Tambah ${menu.name}`}
                              className="size-8 rounded-lg border border-border text-lg leading-none disabled:opacity-40"
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              cart.add({
                                menuId: menu.id,
                                name: menu.name,
                                price: menu.price,
                              })
                            }
                            className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-background"
                          >
                            Tambah
                          </button>
                        )}
                      </div>

                      {menu.available &&
                        menu.remainingPortions <= AMBANG_MENIPIS && (
                          <p className="mt-3 text-xs text-warning">
                            Tinggal {menu.remainingPortions} porsi
                          </p>
                        )}
                    </li>
                  );
                })}
            </ul>
          </section>
        ))}
      </div>

      {cart.count > 0 && !open && (
        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-surface/95 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div className="text-sm">
              <p className="font-medium">
                {cart.count} item · {formatRupiah(cart.total)}
              </p>
              <p className="text-muted">Bayar di kasir setelah pesanan siap</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background"
            >
              Lanjut pesan
            </button>
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-10 flex items-end justify-center bg-black/40 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-border bg-surface p-5 sm:rounded-2xl">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold">Pesanan kamu</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm text-muted"
              >
                Tutup
              </button>
            </div>

            <ul className="mt-4 space-y-3">
              {cart.items.map((item) => (
                <li key={item.menuId} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted">
                      {formatRupiah(item.price)} × {item.qty}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => cart.setQty(item.menuId, item.qty - 1)}
                      aria-label={`Kurangi ${item.name}`}
                      className="size-7 rounded-md border border-border leading-none"
                    >
                      −
                    </button>
                    <span className="w-4 text-center text-sm tabular-nums">
                      {item.qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => cart.setQty(item.menuId, item.qty + 1)}
                      aria-label={`Tambah ${item.name}`}
                      className="size-7 rounded-md border border-border leading-none"
                    >
                      +
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-5 space-y-3 border-t border-border pt-4">
              <label className="block text-sm">
                <span className="text-muted">Nomor meja</span>
                <select
                  value={tableId}
                  onChange={(e) => setTableId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
                >
                  <option value="">Bawa pulang / ambil sendiri</option>
                  {tables.map((t) => (
                    <option key={t.id} value={t.id}>
                      Meja {t.number}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="text-muted">Nama (opsional)</span>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Dipanggil saat pesanan siap"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
                />
              </label>

              <label className="block text-sm">
                <span className="text-muted">Catatan (opsional)</span>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Contoh: es sedikit, gula setengah"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
                />
              </label>
            </div>

            {error && <p className="mt-4 text-sm text-danger">{error}</p>}

            <div className="mt-5 flex items-center justify-between gap-3">
              <div className="text-sm">
                <p className="text-muted">Total</p>
                <p className="text-lg font-semibold">
                  {formatRupiah(cart.total)}
                </p>
              </div>
              <button
                type="button"
                onClick={kirimPesanan}
                disabled={sending || cart.items.length === 0}
                className="rounded-lg bg-accent px-5 py-2.5 font-medium text-background disabled:opacity-50"
              >
                {sending ? "Mengirim…" : "Kirim pesanan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
