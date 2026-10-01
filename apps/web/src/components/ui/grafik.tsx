"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatRupiah } from "@/lib/client-api";

/**
 * Grafik untuk halaman laporan.
 *
 * Dua warna identitas dipakai di seluruh berkas ini: terracotta #c63e23 dan
 * teal #15917a. Pasangan itu diperiksa, bukan dikira-kira — jaraknya 10,9
 * untuk mata deuteranopia (ambangnya 8) dan 27,1 untuk penglihatan biasa,
 * dan keduanya cukup kontras di atas kertas putih. Warna hijau tua yang
 * sudah dipakai di tempat lain (#23554a) justru gagal: terlalu gelap dan
 * kadar warnanya rendah sehingga terbaca abu-abu.
 *
 * Warna melekat pada apa yang diwakili, bukan pada urutan. Omzet selalu
 * terracotta dan laba kotor selalu teal, walau salah satunya disembunyikan.
 */

const OMZET = "#c63e23";
const LABA = "#15917a";

/** Sumbu dan garis bantu dibuat surut supaya datanya yang menonjol. */
const WARNA_SUMBU = "#6b6560";
const WARNA_GARIS = "#e8e6e3";

const sumbuTipis = {
  stroke: WARNA_GARIS,
  tickLine: false,
  axisLine: false,
  tick: { fill: WARNA_SUMBU, fontSize: 12 },
} as const;

/** Rp 1.250.000 jadi "1,3 jt" — sumbu yang penuh angka panjang tidak terbaca. */
function ringkasRupiah(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")} jt`;
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1_000)} rb`;
  return String(n);
}

const tanggalPendek = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(
    new Date(iso),
  );

function KotakTooltip({
  judul,
  baris,
}: {
  judul: string;
  baris: { label: string; nilai: string; warna?: string }[];
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 shadow-lg">
      <p className="text-xs text-muted">{judul}</p>
      <ul className="mt-1 space-y-0.5">
        {baris.map((b) => (
          <li key={b.label} className="flex items-center gap-2 text-sm">
            {b.warna && (
              <span
                aria-hidden="true"
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: b.warna }}
              />
            )}
            <span className="text-muted">{b.label}</span>
            <span className="ml-auto font-medium tabular-nums">{b.nilai}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Penanda warna di samping nama seri. Teks tetap memakai warna teks biasa. */
function Legenda({ seri }: { seri: { nama: string; warna: string }[] }) {
  return (
    <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1">
      {seri.map((s) => (
        <li key={s.nama} className="flex items-center gap-1.5 text-xs text-muted">
          <span
            aria-hidden="true"
            className="size-2.5 rounded-full"
            style={{ background: s.warna }}
          />
          {s.nama}
        </li>
      ))}
    </ul>
  );
}

export type TitikHarian = {
  date: string;
  revenue: string;
  grossProfit: string;
  orderCount: number;
};

/**
 * Omzet dan laba kotor per hari.
 *
 * Satu sumbu untuk keduanya, dan itu sah: dua-duanya rupiah, dan laba kotor
 * memang bagian dari omzet. Sumbu kedua dengan skala berbeda akan membuat
 * dua garis yang tidak sebanding terlihat seolah bisa dibandingkan.
 */
export function GrafikOmzet({ data }: { data: TitikHarian[] }) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">Belum ada penjualan.</p>;
  }

  const titik = data.map((d) => ({
    date: d.date,
    omzet: Number(d.revenue),
    laba: Number(d.grossProfit),
    pesanan: d.orderCount,
  }));

  return (
    <>
      <Legenda
        seri={[
          { nama: "Omzet", warna: OMZET },
          { nama: "Laba kotor", warna: LABA },
        ]}
      />

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={titik} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="isiOmzet" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={OMZET} stopOpacity={0.18} />
                <stop offset="100%" stopColor={OMZET} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="isiLaba" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={LABA} stopOpacity={0.18} />
                <stop offset="100%" stopColor={LABA} stopOpacity={0.02} />
              </linearGradient>
            </defs>

            {/* Garis bantu mendatar saja — garis tegak cuma menambah kerapatan
                tanpa membantu membaca nilainya. */}
            <CartesianGrid stroke={WARNA_GARIS} vertical={false} />
            <XAxis dataKey="date" tickFormatter={tanggalPendek} {...sumbuTipis} />
            <YAxis tickFormatter={ringkasRupiah} width={56} {...sumbuTipis} />

            <Tooltip
              cursor={{ stroke: WARNA_SUMBU, strokeWidth: 1 }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <KotakTooltip
                    judul={new Intl.DateTimeFormat("id-ID", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    }).format(new Date(String(label)))}
                    baris={[
                      {
                        label: "Omzet",
                        warna: OMZET,
                        nilai: formatRupiah(Number(payload[0]?.payload.omzet ?? 0)),
                      },
                      {
                        label: "Laba kotor",
                        warna: LABA,
                        nilai: formatRupiah(Number(payload[0]?.payload.laba ?? 0)),
                      },
                      {
                        label: "Pesanan",
                        nilai: String(payload[0]?.payload.pesanan ?? 0),
                      },
                    ]}
                  />
                ) : null
              }
            />

            <Area
              type="monotone"
              dataKey="omzet"
              stroke={OMZET}
              strokeWidth={2}
              fill="url(#isiOmzet)"
              activeDot={{ r: 4, strokeWidth: 2, stroke: "#ffffff" }}
            />
            <Area
              type="monotone"
              dataKey="laba"
              stroke={LABA}
              strokeWidth={2}
              fill="url(#isiLaba)"
              activeDot={{ r: 4, strokeWidth: 2, stroke: "#ffffff" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

export type BatangData = { nama: string; nilai: number; keterangan?: string };

/**
 * Perbandingan besaran antar nama — batang mendatar.
 *
 * Mendatar, bukan tegak: nama menu panjang-panjang, dan label tegak yang
 * dimiringkan selalu lebih sulit dibaca daripada yang berdiri sendiri di
 * sebelah kiri batangnya.
 *
 * Satu seri, jadi satu warna dan tanpa legenda — judul panelnya sudah
 * menyebut apa yang diukur.
 */
export function GrafikBatang({
  data,
  warna = OMZET,
  format = (n: number) => String(n),
  satuan,
}: {
  data: BatangData[];
  warna?: string;
  format?: (n: number) => string;
  satuan: string;
}) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">Belum ada datanya.</p>;
  }

  return (
    <div style={{ height: Math.max(140, data.length * 34 + 20) }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 56, bottom: 0, left: 0 }}
          barCategoryGap="28%"
        >
          <CartesianGrid stroke={WARNA_GARIS} horizontal={false} />
          <XAxis type="number" tickFormatter={format} hide />
          <YAxis
            type="category"
            dataKey="nama"
            width={128}
            {...sumbuTipis}
            tick={{ fill: "#1c1917", fontSize: 12 }}
          />

          <Tooltip
            cursor={{ fill: "#f4f4f5" }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <KotakTooltip
                  judul={String(payload[0]?.payload.nama ?? "")}
                  baris={[
                    {
                      label: satuan,
                      warna,
                      nilai: format(Number(payload[0]?.payload.nilai ?? 0)),
                    },
                    ...(payload[0]?.payload.keterangan
                      ? [
                          {
                            label: "Catatan",
                            nilai: String(payload[0].payload.keterangan),
                          },
                        ]
                      : []),
                  ]}
                />
              ) : null
            }
          />

          {/* Ujung batang dibulatkan 4px, pangkalnya tetap menempel garis nol
              supaya panjangnya tidak terbaca lebih pendek dari nilainya. */}
          {/* Nilainya ditulis langsung di ujung batang. Dengan sepuluh
              batang, itu lebih cepat dibaca daripada menyusuri sumbu — dan
              sumbu angkanya jadi bisa disembunyikan. */}
          <Bar
            dataKey="nilai"
            radius={[0, 4, 4, 0]}
            label={{
              position: "right",
              formatter: (v) => format(Number(v ?? 0)),
              fill: WARNA_SUMBU,
              fontSize: 11,
            }}
          >
            {data.map((d) => (
              <Cell key={d.nama} fill={warna} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export const WARNA_GRAFIK = { omzet: OMZET, laba: LABA };
