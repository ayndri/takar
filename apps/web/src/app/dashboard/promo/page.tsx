"use client";

import { useState } from "react";
import { IconApi } from "@/components/icons";
import { JagaModul } from "@/components/ui/fitur-mati";
import { Modal } from "@/components/ui/modal";
import { SortHeader } from "@/components/ui/sort-header";
import { StatCard, StatRow } from "@/components/ui/stat-card";
import { PageHead, SearchBox, TablePager } from "@/components/ui/toolbar";
import { ApiError, formatRupiah, formatWaktu, request } from "@/lib/client-api";
import { useSession } from "@/lib/session";
import { useTable } from "@/lib/use-table";
import { useApi } from "@/lib/use-api";

type MenuPromo = {
  id: string;
  name: string;
  category: string;
  price: string;
  promoPrice: string | null;
  promoStartsAt: string | null;
  promoEndsAt: string | null;
  effectivePrice: string;
  isActive: boolean;
  cost: string;
  marginPercent: string;
};

type Pengumuman = {
  id: string;
  title: string;
  body: string;
  linkLabel: string | null;
  linkHref: string | null;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  sedangTampil: boolean;
  createdAt: string;
};

/** ISO → nilai untuk <input type="datetime-local">, dalam waktu browser. */
function keInputWaktu(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const geser = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return geser.toISOString().slice(0, 16);
}

/** Kebalikannya. Kosong berarti "tanpa batas", bukan "sekarang". */
const dariInputWaktu = (v: string) =>
  v ? new Date(v).toISOString() : null;

export default function PromoPage() {
  return (
    <JagaModul kunci="modul.promo">
      <IsiPromo />
    </JagaModul>
  );
}

function IsiPromo() {
  const session = useSession();
  const pemilik = session?.user?.role === "OWNER";

  const menus = useApi<MenuPromo[]>("/api/admin/menus");
  const pengumuman = useApi<Pengumuman[]>("/api/admin/announcements");

  const [ubahPromo, setUbahPromo] = useState<MenuPromo | null>(null);
  const [ubahKabar, setUbahKabar] = useState<Pengumuman | "baru" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const daftar = menus.data ?? [];
  const kabar = pengumuman.data ?? [];

  const sedangPromo = daftar.filter((m) => m.promoPrice !== null);
  const tampil = kabar.find((k) => k.sedangTampil) ?? null;

  const tabel = useTable(daftar, {
    cari: (m) => [m.name, m.category],
    perHalaman: 10,
    kolom: {
      nama: (m) => m.name,
      kategori: (m) => m.category,
      normal: (m) => Number(m.price),
      promo: (m) => (m.promoPrice ? Number(m.promoPrice) : null),
      berlaku: (m) => Number(m.effectivePrice),
      margin: (m) => Number(m.marginPercent),
    },
    urutanAwal: { kolom: "nama", arah: "naik" },
  });

  async function simpanPromo(
    menu: MenuPromo,
    isi: { promoPrice: number | null; mulai: string | null; selesai: string | null },
  ) {
    setError(null);

    try {
      await request(`/api/admin/menus/${menu.id}/promo`, {
        method: "POST",
        body: JSON.stringify({
          promoPrice: isi.promoPrice,
          promoStartsAt: isi.mulai,
          promoEndsAt: isi.selesai,
        }),
      });

      await menus.mutate();
      setUbahPromo(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal menyimpan promo");
    }
  }

  async function aksiKabar(path: string, init: RequestInit) {
    setError(null);

    try {
      await request(path, init);
      await pengumuman.mutate();
      setUbahKabar(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal menyimpan pengumuman");
    }
  }

  return (
    <div>
      <PageHead
        judul="Promo & pengumuman"
        deskripsi="Potongan harga per menu dan satu banner di beranda. Harga normal tidak ditimpa — begitu rentang promonya lewat, harganya kembali sendiri."
        aksi={
          pemilik ? (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setUbahKabar("baru");
              }}
              className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white"
            >
              Pengumuman baru
            </button>
          ) : undefined
        }
      />

      <StatRow>
        <StatCard
          label="Menu sedang promo"
          nilai={menus.isLoading ? "…" : String(sedangPromo.length)}
        />
        <StatCard
          label="Pengumuman tampil"
          nilai={pengumuman.isLoading ? "…" : tampil ? "Ada" : "Tidak ada"}
          catatan={tampil?.title}
          nada={tampil ? "sorot" : "netral"}
        />
        <StatCard
          label="Pengumuman tersimpan"
          nilai={pengumuman.isLoading ? "…" : String(kabar.length)}
          catatan="termasuk yang dimatikan"
        />
        <StatCard
          label="Margin tertipis saat promo"
          nilai={
            sedangPromo.length === 0
              ? "—"
              : `${Math.min(...sedangPromo.map((m) => Number(m.marginPercent))).toFixed(1)}%`
          }
          catatan="dihitung terhadap harga promo"
          nada={
            sedangPromo.some((m) => Number(m.marginPercent) < 0) ? "rugi" : "netral"
          }
        />
      </StatRow>

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {/* ── pengumuman ── */}
      <section className="mb-8">
        <h2 className="mb-3 font-semibold">Pengumuman beranda</h2>

        {kabar.length === 0 && !pengumuman.isLoading && (
          <p className="rounded-xl border border-border bg-surface p-5 text-sm text-muted">
            Belum ada pengumuman. Yang dibuat paling akhir yang akan tampil di
            beranda.
          </p>
        )}

        <ul className="space-y-2">
          {kabar.map((k) => (
            <li
              key={k.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-surface p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {k.title}
                  {k.sedangTampil && (
                    <span className="ml-2 rounded bg-accent-soft px-1.5 py-0.5 text-xs font-normal text-accent-ink">
                      sedang tampil
                    </span>
                  )}
                  {!k.isActive && (
                    <span className="ml-2 rounded bg-sunk px-1.5 py-0.5 text-xs font-normal text-muted">
                      dimatikan
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-sm text-muted">{k.body}</p>
                <p className="mt-1 text-xs text-muted">
                  {k.startsAt ? formatWaktu(k.startsAt) : "sejak kapan pun"} —{" "}
                  {k.endsAt ? formatWaktu(k.endsAt) : "sampai dilepas"}
                  {k.linkLabel && ` · tautan: ${k.linkLabel}`}
                </p>
              </div>

              {pemilik && (
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setUbahKabar(k);
                    }}
                    className="rounded-lg border border-border px-2.5 py-1 text-xs hover:border-accent"
                  >
                    Ubah
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      aksiKabar(`/api/admin/announcements/${k.id}/toggle`, {
                        method: "POST",
                      })
                    }
                    className="rounded-lg border border-border px-2.5 py-1 text-xs hover:border-accent"
                  >
                    {k.isActive ? "Matikan" : "Nyalakan"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Hapus pengumuman "${k.title}"? Tidak bisa dikembalikan.`,
                        )
                      ) {
                        aksiKabar(`/api/admin/announcements/${k.id}`, {
                          method: "DELETE",
                        });
                      }
                    }}
                    className="rounded-lg border border-border px-2.5 py-1 text-xs text-danger hover:border-danger"
                  >
                    Hapus
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* ── promo harga ── */}
      <section>
        <h2 className="mb-3 font-semibold">Harga promo per menu</h2>

        <div className="mb-3">
          <SearchBox
            nilai={tabel.kata}
            onChange={tabel.setKata}
            placeholder="Cari menu atau kategori…"
          />
        </div>

        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-muted">
              <tr>
                <SortHeader label="Menu" kolom="nama" urutan={tabel.urutan} onUrutkan={tabel.urutkan} />
                <SortHeader label="Kategori" kolom="kategori" urutan={tabel.urutan} onUrutkan={tabel.urutkan} />
                <SortHeader label="Harga normal" kolom="normal" urutan={tabel.urutan} onUrutkan={tabel.urutkan} rata="kanan" />
                <SortHeader label="Harga promo" kolom="promo" urutan={tabel.urutan} onUrutkan={tabel.urutkan} rata="kanan" />
                <SortHeader label="Margin" kolom="margin" urutan={tabel.urutan} onUrutkan={tabel.urutkan} rata="kanan" />
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {menus.isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted">
                    Memuat menu…
                  </td>
                </tr>
              )}

              {!menus.isLoading && tabel.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted">
                    Tidak ada menu yang cocok.
                  </td>
                </tr>
              )}

              {tabel.items.map((m) => {
                const promo = m.promoPrice !== null;
                const margin = Number(m.marginPercent);

                return (
                  <tr key={m.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      {m.name}
                      {promo && (
                        <IconApi className="ml-1.5 inline size-3.5 text-danger" aria-label="sedang promo" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">{m.category}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatRupiah(m.price)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {promo ? (
                        <span className="font-medium text-danger">
                          {formatRupiah(m.promoPrice!)}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td
                      className={`px-4 py-3 text-right tabular-nums ${
                        margin < 0 ? "text-danger" : margin < 15 ? "text-warning" : ""
                      }`}
                    >
                      {m.marginPercent}%
                    </td>
                    <td className="px-4 py-3 text-right">
                      {pemilik && (
                        <button
                          type="button"
                          onClick={() => {
                            setError(null);
                            setUbahPromo(m);
                          }}
                          className="rounded-lg border border-border px-2.5 py-1 text-xs hover:border-accent"
                        >
                          {promo ? "Ubah promo" : "Pasang promo"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <TablePager
          halaman={tabel.halaman}
          halamanTotal={tabel.halamanTotal}
          awal={tabel.awal}
          akhir={tabel.akhir}
          total={tabel.total}
          satuan="menu"
          onGanti={tabel.setHalaman}
        />
      </section>

      {ubahPromo && (
        <FormPromo
          menu={ubahPromo}
          onClose={() => setUbahPromo(null)}
          onSimpan={(isi) => simpanPromo(ubahPromo, isi)}
        />
      )}

      {ubahKabar && (
        <FormPengumuman
          awal={ubahKabar === "baru" ? null : ubahKabar}
          onClose={() => setUbahKabar(null)}
          onSimpan={(body) =>
            aksiKabar(
              ubahKabar === "baru"
                ? "/api/admin/announcements"
                : `/api/admin/announcements/${ubahKabar.id}`,
              {
                method: ubahKabar === "baru" ? "POST" : "PUT",
                body: JSON.stringify(body),
              },
            )
          }
        />
      )}
    </div>
  );
}

function FormPromo({
  menu,
  onClose,
  onSimpan,
}: {
  menu: MenuPromo;
  onClose: () => void;
  onSimpan: (isi: {
    promoPrice: number | null;
    mulai: string | null;
    selesai: string | null;
  }) => void;
}) {
  const [harga, setHarga] = useState(menu.promoPrice ?? "");
  const [mulai, setMulai] = useState(keInputWaktu(menu.promoStartsAt));
  const [selesai, setSelesai] = useState(keInputWaktu(menu.promoEndsAt));

  const angka = Number(harga);
  const sah = harga !== "" && angka > 0 && angka < Number(menu.price);
  const potongan = sah
    ? Math.round(((Number(menu.price) - angka) / Number(menu.price)) * 100)
    : null;

  // Modal dipakai ulang: HPP tidak berubah, jadi margin promo bisa dihitung
  // di sini tanpa menunggu server.
  const marginPromo = sah
    ? (((angka - Number(menu.cost)) / angka) * 100).toFixed(1)
    : null;

  return (
    <Modal
      judul={`Promo ${menu.name}`}
      deskripsi={`Harga normal ${formatRupiah(menu.price)} · HPP ${formatRupiah(menu.cost)}`}
      onClose={onClose}
    >
      <div className="space-y-4">
        <label className="block text-sm">
          <span className="text-muted">Harga promo</span>
          <input
            type="number"
            min={1}
            step={500}
            value={harga}
            onChange={(e) => setHarga(e.target.value)}
            placeholder="Kosongkan untuk melepas promo"
            className="mt-1 w-full rounded-xl border border-border bg-paper px-3 py-2.5"
          />
          {harga !== "" && !sah && (
            <span className="mt-1 block text-xs text-danger">
              Harus lebih dari nol dan lebih murah dari {formatRupiah(menu.price)}.
            </span>
          )}
          {sah && (
            <span className="mt-1 block text-xs text-muted">
              Potongan {potongan}% · margin jadi{" "}
              <span className={Number(marginPromo) < 0 ? "text-danger" : ""}>
                {marginPromo}%
              </span>
            </span>
          )}
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-muted">Mulai (opsional)</span>
            <input
              type="datetime-local"
              value={mulai}
              onChange={(e) => setMulai(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-paper px-3 py-2.5"
            />
          </label>

          <label className="block text-sm">
            <span className="text-muted">Selesai (opsional)</span>
            <input
              type="datetime-local"
              value={selesai}
              onChange={(e) => setSelesai(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-paper px-3 py-2.5"
            />
          </label>
        </div>

        <p className="text-xs text-muted">
          Dikosongkan berarti tanpa batas di sisi itu. Tanpa keduanya, promo
          berjalan sampai dilepas.
        </p>

        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <button
            type="button"
            disabled={harga !== "" && !sah}
            onClick={() =>
              onSimpan({
                promoPrice: harga === "" ? null : angka,
                mulai: dariInputWaktu(mulai),
                selesai: dariInputWaktu(selesai),
              })
            }
            className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Simpan
          </button>

          {menu.promoPrice !== null && (
            <button
              type="button"
              onClick={() =>
                onSimpan({ promoPrice: null, mulai: null, selesai: null })
              }
              className="rounded-xl border border-border px-4 py-2 text-sm"
            >
              Lepas promo
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function FormPengumuman({
  awal,
  onClose,
  onSimpan,
}: {
  awal: Pengumuman | null;
  onClose: () => void;
  onSimpan: (body: Record<string, unknown>) => void;
}) {
  const [title, setTitle] = useState(awal?.title ?? "");
  const [body, setBody] = useState(awal?.body ?? "");
  const [linkLabel, setLinkLabel] = useState(awal?.linkLabel ?? "");
  const [linkHref, setLinkHref] = useState(awal?.linkHref ?? "");
  const [mulai, setMulai] = useState(keInputWaktu(awal?.startsAt ?? null));
  const [selesai, setSelesai] = useState(keInputWaktu(awal?.endsAt ?? null));

  const tautanTimpang =
    Boolean(linkLabel.trim()) !== Boolean(linkHref.trim());

  return (
    <Modal
      judul={awal ? "Ubah pengumuman" : "Pengumuman baru"}
      deskripsi="Yang tampil di beranda cuma satu — yang paling baru di antara yang aktif."
      onClose={onClose}
    >
      <div className="space-y-4">
        <label className="block text-sm">
          <span className="text-muted">Judul</span>
          <input
            value={title}
            maxLength={80}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Kopi kedua setengah harga"
            className="mt-1 w-full rounded-xl border border-border bg-paper px-3 py-2.5"
          />
        </label>

        <label className="block text-sm">
          <span className="text-muted">Isi</span>
          <textarea
            value={body}
            maxLength={300}
            rows={2}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Berlaku tiap Jumat, pukul 15.00 sampai tutup."
            className="mt-1 w-full rounded-xl border border-border bg-paper px-3 py-2.5"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-muted">Teks tautan (opsional)</span>
            <input
              value={linkLabel}
              maxLength={40}
              onChange={(e) => setLinkLabel(e.target.value)}
              placeholder="Lihat menunya"
              className="mt-1 w-full rounded-xl border border-border bg-paper px-3 py-2.5"
            />
          </label>

          <label className="block text-sm">
            <span className="text-muted">Alamat tautan</span>
            <input
              value={linkHref}
              maxLength={200}
              onChange={(e) => setLinkHref(e.target.value)}
              placeholder="/menu?category=Kopi"
              className="mt-1 w-full rounded-xl border border-border bg-paper px-3 py-2.5"
            />
          </label>
        </div>

        {tautanTimpang && (
          <p className="text-xs text-danger">
            Teks dan alamat tautan harus diisi dua-duanya, atau dikosongkan
            dua-duanya.
          </p>
        )}

        <p className="text-xs text-muted">
          Alamat harus di dalam situs ini, diawali garis miring — misalnya{" "}
          <code>/menu</code> atau <code>/reservasi</code>.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-muted">Mulai tampil (opsional)</span>
            <input
              type="datetime-local"
              value={mulai}
              onChange={(e) => setMulai(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-paper px-3 py-2.5"
            />
          </label>

          <label className="block text-sm">
            <span className="text-muted">Berhenti tampil (opsional)</span>
            <input
              type="datetime-local"
              value={selesai}
              onChange={(e) => setSelesai(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-paper px-3 py-2.5"
            />
          </label>
        </div>

        <div className="border-t border-border pt-4">
          <button
            type="button"
            disabled={title.trim().length < 3 || body.trim().length < 3 || tautanTimpang}
            onClick={() =>
              onSimpan({
                title: title.trim(),
                body: body.trim(),
                linkLabel: linkLabel.trim() || null,
                linkHref: linkHref.trim() || null,
                startsAt: dariInputWaktu(mulai),
                endsAt: dariInputWaktu(selesai),
              })
            }
            className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Simpan
          </button>
        </div>
      </div>
    </Modal>
  );
}
