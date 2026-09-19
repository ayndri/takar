"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { SortHeader } from "@/components/ui/sort-header";
import { StatCard, StatRow } from "@/components/ui/stat-card";
import { PageHead, SearchBox, TablePager } from "@/components/ui/toolbar";
import { ApiError, formatRupiah, formatWaktu, request } from "@/lib/client-api";
import { useSession } from "@/lib/session";
import { useTable } from "@/lib/use-table";
import { useApi } from "@/lib/use-api";

type Ingredient = {
  id: string;
  name: string;
  baseUnit: string;
  qty: string;
};

type Opname = {
  id: string;
  date: string;
  note: string | null;
  by: string;
  totalValue: string;
  items: {
    ingredientId: string;
    name: string;
    baseUnit: string;
    systemQty: string;
    physicalQty: string;
    diff: string;
    value: string;
  }[];
};

export default function OpnamePage() {
  const session = useSession();
  const pemilik = session?.user?.role === "OWNER";

  const bahan = useApi<Ingredient[]>("/api/ingredients");
  const riwayat = useApi<Opname[]>("/api/opname");

  const [formTerbuka, setFormTerbuka] = useState(false);
  const [fisik, setFisik] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [cariBahan, setCariBahan] = useState("");

  const ingredients = bahan.data ?? [];
  const history = riwayat.data ?? [];

  const tabel = useTable(history, {
    cari: (o) => [o.by, o.note, ...o.items.map((i) => i.name)],
    perHalaman: 8,
    kolom: {
      tanggal: (o) => new Date(o.date),
      oleh: (o) => o.by,
      catatan: (o) => o.note ?? "",
      diperiksa: (o) => o.items.length,
      selisih: (o) => Number(o.totalValue),
    },
    urutanAwal: { kolom: "tanggal", arah: "turun" },
  });

  const terakhir = history[0];
  const selisihTerakhir = terakhir ? Number(terakhir.totalValue) : 0;
  const totalSelisih = history.reduce((s, o) => s + Number(o.totalValue), 0);
  const dibuka = history.find((o) => o.id === openId);

  const bahanTersaring = ingredients.filter((i) =>
    i.name.toLowerCase().includes(cariBahan.trim().toLowerCase()),
  );

  const terisi = Object.values(fisik).filter((v) => v.trim() !== "").length;

  async function simpan(e: React.FormEvent) {
    e.preventDefault();

    const items = Object.entries(fisik)
      .filter(([, v]) => v.trim() !== "")
      .map(([ingredientId, v]) => ({
        ingredientId,
        physicalQty: Number(v),
      }));

    if (items.length === 0) {
      setError("Isi minimal satu hasil hitung fisik");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await request("/api/opname", {
        method: "POST",
        body: JSON.stringify({
          ...(note.trim() && { note: note.trim() }),
          items,
        }),
      });

      setFisik({});
      setNote("");
      setFormTerbuka(false);
      await Promise.all([bahan.mutate(), riwayat.mutate()]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal menyimpan opname");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHead
        judul="Stock opname"
        deskripsi="Hitung fisik. Angka sistem tidak ditimpa, selisihnya dicatat sebagai penyesuaian."
        aksi={
          <button
            type="button"
            onClick={() => setFormTerbuka(true)}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-ink"
          >
            Mulai opname
          </button>
        }
      />

      <StatRow>
        <StatCard
          label="Jumlah opname"
          nilai={riwayat.isLoading ? "…" : String(history.length)}
        />
        <StatCard
          label="Opname terakhir"
          nilai={terakhir ? formatWaktu(terakhir.date).split(",")[0]! : "belum ada"}
          catatan={terakhir ? `oleh ${terakhir.by}` : undefined}
        />
        {pemilik && terakhir && (
          <StatCard
            label="Selisih terakhir"
            nilai={formatRupiah(selisihTerakhir)}
            nada={selisihTerakhir < 0 ? "rugi" : "netral"}
          />
        )}
        {pemilik && history.length > 0 && (
          <StatCard
            label="Selisih keseluruhan"
            nilai={formatRupiah(totalSelisih)}
            catatan="dari semua opname"
            nada={totalSelisih < 0 ? "rugi" : "netral"}
          />
        )}
      </StatRow>

      <div className="mb-3">
        <SearchBox
          nilai={tabel.kata}
          onChange={tabel.setKata}
          placeholder="Cari pencatat, catatan, atau bahan…"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-muted">
            <tr>
              <SortHeader
                label="Tanggal"
                kolom="tanggal"
                urutan={tabel.urutan}
                onUrutkan={tabel.urutkan}
              />
              <SortHeader
                label="Oleh"
                kolom="oleh"
                urutan={tabel.urutan}
                onUrutkan={tabel.urutkan}
              />
              <SortHeader
                label="Catatan"
                kolom="catatan"
                urutan={tabel.urutan}
                onUrutkan={tabel.urutkan}
              />
              <SortHeader
                label="Bahan diperiksa"
                kolom="diperiksa"
                urutan={tabel.urutan}
                onUrutkan={tabel.urutkan}
                rata="kanan"
              />
              {pemilik && (
                <SortHeader
                  label="Selisih"
                  kolom="selisih"
                  urutan={tabel.urutan}
                  onUrutkan={tabel.urutkan}
                  rata="kanan"
                />
              )}
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {riwayat.isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  Memuat riwayat opname…
                </td>
              </tr>
            )}

            {!riwayat.isLoading && tabel.items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  {history.length === 0
                    ? "Belum pernah opname."
                    : "Tidak ada opname yang cocok."}
                </td>
              </tr>
            )}

            {tabel.items.map((op) => (
              <tr key={op.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 whitespace-nowrap">
                  {formatWaktu(op.date)}
                </td>
                <td className="px-4 py-3 text-muted">{op.by}</td>
                <td className="px-4 py-3 text-muted">{op.note ?? "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {op.items.length}
                </td>
                {pemilik && (
                  <td
                    className={`px-4 py-3 text-right tabular-nums ${
                      Number(op.totalValue) < 0 ? "text-danger" : ""
                    }`}
                  >
                    {formatRupiah(op.totalValue)}
                  </td>
                )}
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => setOpenId(op.id)}
                    className="rounded-lg border border-border px-2.5 py-1 text-xs whitespace-nowrap hover:border-accent"
                  >
                    Lihat rincian
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TablePager
        halaman={tabel.halaman}
        halamanTotal={tabel.halamanTotal}
        awal={tabel.awal}
        akhir={tabel.akhir}
        total={tabel.total}
        satuan="opname"
        onGanti={tabel.setHalaman}
      />

      {dibuka && (
        <Modal
          judul={`Opname ${formatWaktu(dibuka.date)}`}
          deskripsi={`oleh ${dibuka.by}${dibuka.note ? ` · ${dibuka.note}` : ""}`}
          lebar="lg"
          onClose={() => setOpenId(null)}
        >
          <RincianOpname opname={dibuka} pemilik={pemilik} />
        </Modal>
      )}

      {formTerbuka && (
        <Modal
          judul="Hitung fisik"
          deskripsi="Isi hanya bahan yang kamu hitung. Yang dikosongkan tidak ikut disesuaikan."
          lebar="lg"
          onClose={() => setFormTerbuka(false)}
        >
          <form onSubmit={simpan}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <SearchBox
                nilai={cariBahan}
                onChange={setCariBahan}
                placeholder="Cari bahan…"
              />
              <p className="text-sm text-muted">{terisi} bahan terisi</p>
            </div>

            <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface text-left text-muted">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 font-medium">Bahan</th>
                    <th className="px-3 py-2 text-right font-medium">Sistem</th>
                    <th className="px-3 py-2 text-right font-medium">Fisik</th>
                    <th className="px-3 py-2 text-right font-medium">Selisih</th>
                  </tr>
                </thead>
                <tbody>
                  {bahanTersaring.map((item) => {
                    const isi = fisik[item.id] ?? "";
                    const selisih =
                      isi.trim() === "" ? null : Number(isi) - Number(item.qty);

                    return (
                      <tr key={item.id} className="border-t border-border">
                        <td className="px-3 py-2">{item.name}</td>
                        <td className="px-3 py-2 text-right text-muted tabular-nums">
                          {item.qty} {item.baseUnit.toLowerCase()}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            step="0.001"
                            min="0"
                            value={isi}
                            onChange={(e) =>
                              setFisik((prev) => ({
                                ...prev,
                                [item.id]: e.target.value,
                              }))
                            }
                            placeholder="·"
                            aria-label={`Hitung fisik ${item.name}`}
                            className="w-28 rounded-lg border border-border bg-paper px-2 py-1 text-right"
                          />
                        </td>
                        <td
                          className={`px-3 py-2 text-right tabular-nums ${
                            selisih === null
                              ? "text-muted"
                              : selisih < 0
                                ? "text-danger"
                                : selisih > 0
                                  ? "text-warning"
                                  : "text-muted"
                          }`}
                        >
                          {selisih === null
                            ? "·"
                            : `${selisih > 0 ? "+" : ""}${selisih}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Catatan opname (opsional)"
              className="mt-4 w-full rounded-xl border border-border bg-paper px-3 py-2.5 text-sm"
            />

            {error && <p className="mt-3 text-sm text-danger">{error}</p>}

            <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setFormTerbuka(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving || terisi === 0}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? "Menyimpan…" : `Simpan ${terisi} bahan`}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

/**
 * Isi pop-up rincian opname.
 *
 * Diurutkan dari selisih paling merugikan lebih dulu, karena itu yang
 * biasanya dicari saat membuka hasil hitung fisik.
 */
function RincianOpname({
  opname,
  pemilik,
}: {
  opname: Opname;
  pemilik: boolean;
}) {
  const tabel = useTable(opname.items, {
    cari: (i) => [i.name],
    perHalaman: 10,
    kolom: {
      bahan: (i) => i.name,
      sistem: (i) => Number(i.systemQty),
      fisik: (i) => Number(i.physicalQty),
      selisih: (i) => Number(i.diff),
      nilai: (i) => Number(i.value),
    },
    urutanAwal: { kolom: "selisih", arah: "naik" },
  });

  const banyak = opname.items.length > 10;

  return (
    <>
      {banyak && (
        <div className="mb-3">
          <SearchBox
            nilai={tabel.kata}
            onChange={tabel.setKata}
            placeholder="Cari bahan di opname ini…"
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-muted">
            <tr>
              <SortHeader
                label="Bahan"
                kolom="bahan"
                urutan={tabel.urutan}
                onUrutkan={tabel.urutkan}
              />
              <SortHeader
                label="Sistem"
                kolom="sistem"
                urutan={tabel.urutan}
                onUrutkan={tabel.urutkan}
                rata="kanan"
              />
              <SortHeader
                label="Fisik"
                kolom="fisik"
                urutan={tabel.urutan}
                onUrutkan={tabel.urutkan}
                rata="kanan"
              />
              <SortHeader
                label="Selisih"
                kolom="selisih"
                urutan={tabel.urutan}
                onUrutkan={tabel.urutkan}
                rata="kanan"
              />
              {pemilik && (
                <SortHeader
                  label="Nilai"
                  kolom="nilai"
                  urutan={tabel.urutan}
                  onUrutkan={tabel.urutkan}
                  rata="kanan"
                />
              )}
            </tr>
          </thead>
          <tbody>
            {tabel.items.map((i) => (
              <tr
                key={i.ingredientId}
                className="border-b border-border last:border-0"
              >
                <td className="px-4 py-2">{i.name}</td>
                <td className="px-4 py-2 text-right text-muted tabular-nums">
                  {i.systemQty}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {i.physicalQty}
                </td>
                <td
                  className={`px-4 py-2 text-right tabular-nums ${
                    Number(i.diff) < 0 ? "text-danger" : ""
                  }`}
                >
                  {Number(i.diff) > 0 ? "+" : ""}
                  {i.diff}
                </td>
                {pemilik && (
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatRupiah(i.value)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {banyak && (
        <TablePager
          halaman={tabel.halaman}
          halamanTotal={tabel.halamanTotal}
          awal={tabel.awal}
          akhir={tabel.akhir}
          total={tabel.total}
          satuan="bahan"
          onGanti={tabel.setHalaman}
        />
      )}

      {pemilik && (
        <p className="mt-4 flex justify-between border-t border-border pt-3 font-medium">
          <span>Total selisih</span>
          <span
            className={`tabular-nums ${
              Number(opname.totalValue) < 0 ? "text-danger" : ""
            }`}
          >
            {formatRupiah(opname.totalValue)}
          </span>
        </p>
      )}
    </>
  );
}
