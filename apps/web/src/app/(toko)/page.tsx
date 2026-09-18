import Image from "next/image";
import Link from "next/link";
import { ActiveOrderBar } from "@/components/active-order-bar";
import {
  IconCatatan,
  IconJam,
  IconKasir,
  IconQR,
  IconTakar,
} from "@/components/icons";
import { HeroSearch } from "@/components/hero-search";
import { MenuCard } from "@/components/menu-card";
import { PilihanUtama } from "@/components/pilihan-utama";
import { Takaran } from "@/components/takaran";
import { formatRupiah, getPublicMenus, type PublicMenu } from "@/lib/api";
import { urutkanKategori } from "@/lib/kategori";

// Beranda memuat sisa porsi yang berubah tiap pesanan masuk.
export const dynamic = "force-dynamic";

const FOTO_HERO =
  "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=1600&q=75";

/** Satu foto mewakili tiap kategori di baris pemilih. */
const FOTO_KATEGORI: Record<string, string> = {
  Kopi: "photo-1541167760496-1628856ab772",
  "Non-kopi": "photo-1515823064-d6e0c04616a7",
  "Jus & Smoothie": "photo-1621506289937-a8e4df240d0b",
  Sarapan: "photo-1588137378633-dea1336ce1e2",
  Nasi: "photo-1603133872878-684f208fb84b",
  Mie: "photo-1552611052-33e04de081de",
  "Roti & Burger": "photo-1568901346375-23c9450c58cd",
  Camilan: "photo-1573080496219-bb080dd4f877",
  Salad: "photo-1512621776951-a57141f2eefd",
  Manis: "photo-1606313564200-e75d5e30476c",
};

const JANJI = [
  {
    Ikon: IconQR,
    judul: "Pesan dari meja",
    detail: "Tanpa antre, tanpa bikin akun",
  },
  {
    Ikon: IconTakar,
    judul: "Stok dihitung per takaran",
    detail: "Bahan kurang, menunya tutup",
  },
  {
    Ikon: IconKasir,
    judul: "Bayar di kasir",
    detail: "Tunai atau kartu, setelah siap",
  },
  {
    Ikon: IconCatatan,
    judul: "Catatan diteruskan",
    detail: "Es sedikit, gula setengah, ikut tercatat",
  },
  {
    Ikon: IconJam,
    judul: "Status bisa dilacak",
    detail: "Dari diterima sampai siap diambil",
  },
];

export default async function BerandaPage() {
  let menus: PublicMenu[] = [];
  let gagal = false;

  try {
    menus = await getPublicMenus();
  } catch {
    gagal = true;
  }

  const tersedia = menus.filter((m) => m.available);

  const kategori = urutkanKategori([
    ...new Set(menus.map((m) => m.category)),
  ]).map((nama) => ({
    nama,
    jumlah: menus.filter((m) => m.category === nama).length,
    foto: FOTO_KATEGORI[nama],
  }));

  const terlaris = [...tersedia].sort((a, b) => b.soldThisWeek - a.soldThisWeek);
  const populer = terlaris.slice(0, 3);
  const unggulan = terlaris[0];
  const pilihanLain = terlaris.slice(3, 9);
  const menipis = tersedia
    .filter((m) => m.remainingPortions <= 5)
    .sort((a, b) => a.remainingPortions - b.remainingPortions);

  return (
    <main>
      {/* ── hero ── */}
      <section className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 sm:pt-8">
        <div className="relative overflow-hidden rounded-3xl">
          <Image
            src={FOTO_HERO}
            alt=""
            fill
            priority
            sizes="(max-width: 1280px) 100vw, 1152px"
            className="object-cover object-right"
          />

          {/* Lapisan kertas dari kiri: teks tetap hitam di atas dasar terang,
              jadi kontrasnya tidak bergantung pada isi fotonya. */}
          <div className="absolute inset-0 bg-linear-to-r from-paper from-30% via-paper/95 via-55% to-paper/20" />

          <div className="relative max-w-xl px-6 py-10 sm:px-10 sm:py-14 lg:py-20">
            <p className="inline-flex rounded-full bg-accent-soft px-3 py-1 text-sm font-medium text-accent-ink">
              Pesan sendiri dari meja
            </p>

            <h1 className="mt-4 font-display text-4xl leading-[1.03] font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Makan enak,
              <br />
              takarannya pas.
            </h1>

            <p className="mt-4 max-w-md text-muted">
              {menus.length} menu, dari kopi sampai nasi goreng, diracik setelah
              kamu pesan. Yang tampil di daftar cuma yang bahannya benar-benar
              ada di dapur.
            </p>

            <div className="mt-6">
              <HeroSearch />
            </div>

            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <Link
                href="/menu"
                className="rounded-xl bg-accent px-5 py-3 font-medium text-white hover:bg-accent-ink"
              >
                Lihat menu hari ini
              </Link>
              <Link
                href="/pesanan"
                className="rounded-xl border border-border bg-surface px-5 py-3 font-medium hover:border-accent"
              >
                Lacak pesanan
              </Link>
            </div>

            {!gagal && (
              <p className="mt-6 text-sm text-muted">
                <span className="font-medium text-ink">
                  {tersedia.length} dari {menus.length}
                </span>{" "}
                menu bisa dibuat sekarang
              </p>
            )}
          </div>
        </div>
      </section>

      {gagal ? (
        <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="rounded-2xl border border-border bg-surface p-6">
            <p className="font-medium text-accent-ink">Menu belum bisa dimuat</p>
            <p className="mt-1 text-sm text-muted">
              Layanan pesanan sedang tidak bisa dihubungi. Coba muat ulang
              halaman, atau pesan langsung ke kasir.
            </p>
          </div>
        </section>
      ) : menus.length === 0 ? (
        <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <p className="font-display text-xl">Menu belum disusun</p>
            <p className="mt-1 text-sm text-muted">
              Belum ada menu aktif. Tanyakan ke kasir untuk pesanan hari ini.
            </p>
          </div>
        </section>
      ) : (
        <>
          {/* ── kategori ── */}
          <section className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
            <h2 className="sr-only">Kategori menu</h2>

            <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
              <li className="shrink-0">
                <Link
                  href="/menu"
                  className="flex w-[84px] flex-col items-center gap-2 rounded-2xl border-2 border-accent bg-accent-soft px-2 py-3 text-center"
                >
                  <span className="grid size-11 place-items-center rounded-full bg-surface font-display text-sm font-semibold text-accent-ink">
                    {menus.length}
                  </span>
                  <span className="text-xs leading-tight font-medium text-accent-ink">
                    Semua
                  </span>
                </Link>
              </li>

              {kategori.map((k) => (
                <li key={k.nama} className="shrink-0">
                  <Link
                    href={`/menu?kategori=${encodeURIComponent(k.nama)}`}
                    className="flex w-[84px] flex-col items-center gap-2 rounded-2xl border-2 border-transparent bg-surface px-2 py-3 text-center hover:border-accent"
                  >
                    <span className="relative size-11 overflow-hidden rounded-full bg-sunk">
                      {k.foto && (
                        <Image
                          src={`https://images.unsplash.com/${k.foto}?w=120&q=70`}
                          alt=""
                          fill
                          sizes="44px"
                          className="object-cover"
                        />
                      )}
                    </span>
                    <span className="text-xs leading-tight font-medium">
                      {k.nama}
                    </span>
                    <span className="text-[11px] text-muted">{k.jumlah}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* ── populer + panel ── */}
          <section className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
            <div className="flex items-baseline justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-semibold">
                  Paling laku minggu ini
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Dihitung dari pesanan yang benar-benar dikonfirmasi kasir.
                </p>
              </div>
              <Link
                href="/menu"
                className="shrink-0 text-sm font-medium text-accent-ink hover:underline"
              >
                Lihat semua
              </Link>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-4">
              {populer.map((menu, i) => (
                <MenuCard
                  key={menu.id}
                  menu={menu}
                  peringkat={i === 0 ? "Terlaris" : undefined}
                />
              ))}

              {/* Panel ini menggantikan spanduk diskon: isinya keadaan stok
                  hari ini, yang memang berubah dan memang benar. */}
              <div className="flex flex-col justify-between rounded-2xl bg-forest p-5 text-paper">
                <div>
                  <p className="text-sm text-paper/80">Perlu diburu duluan</p>
                  <h3 className="mt-1 font-display text-2xl leading-tight font-semibold">
                    {menipis.length > 0
                      ? "Beberapa menu tinggal sedikit"
                      : "Semua bahan masih aman"}
                  </h3>
                </div>

                {menipis.length > 0 ? (
                  <ul className="mt-4 space-y-2 text-sm">
                    {menipis.slice(0, 3).map((m) => (
                      <li key={m.id} className="flex justify-between gap-2">
                        <Link
                          href={`/menu/${m.id}`}
                          className="truncate hover:underline"
                        >
                          {m.name}
                        </Link>
                        <span className="shrink-0 text-paper/80 tabular-nums">
                          {m.remainingPortions} porsi
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-sm text-paper/85">
                    Tidak ada menu yang stoknya di bawah lima porsi. Pesan
                    santai saja.
                  </p>
                )}

                <Link
                  href="/menu"
                  className="mt-5 inline-block rounded-xl bg-paper px-4 py-2 text-center text-sm font-medium text-forest"
                >
                  Susun pesanan
                </Link>
              </div>
            </div>
          </section>

          {/* ── status pesanan berjalan ── */}
          <section className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
            <ActiveOrderBar />
          </section>

          {/* ── unggulan + pilihan ── */}
          {unggulan && (
            <section className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
              <div className="grid gap-4 lg:grid-cols-[1.1fr_1.4fr]">
                <article className="overflow-hidden rounded-3xl bg-surface">
                  <div className="relative aspect-4/3">
                    {unggulan.imageUrl && (
                      <Image
                        src={unggulan.imageUrl}
                        alt=""
                        fill
                        sizes="(max-width: 1024px) 100vw, 440px"
                        className="object-cover"
                      />
                    )}
                    <span className="absolute top-4 left-4 rounded-lg bg-accent px-2.5 py-1 text-xs font-medium text-white">
                      Terlaris
                    </span>
                  </div>

                  <div className="p-5">
                    <p className="text-xs text-muted">{unggulan.category}</p>
                    <h3 className="mt-1 font-display text-2xl font-semibold">
                      {unggulan.name}
                    </h3>
                    <p className="mt-1 text-sm text-muted">
                      Terjual {unggulan.soldThisWeek} porsi tujuh hari terakhir,
                      dari {unggulan.ingredientCount} bahan.
                    </p>

                    <div className="mt-4 flex items-center gap-3">
                      <Takaran sisa={unggulan.remainingPortions} />
                      <span className="text-sm text-muted">
                        sisa {unggulan.remainingPortions} porsi
                      </span>
                    </div>

                    <div className="mt-5 flex items-center justify-between gap-4">
                      <span className="font-display text-2xl font-semibold tabular-nums">
                        {formatRupiah(unggulan.price)}
                      </span>
                      <PilihanUtama menu={unggulan} />
                    </div>
                  </div>
                </article>

                <div>
                  <div className="flex items-baseline justify-between gap-4">
                    <h2 className="font-display text-2xl font-semibold">
                      Sering dipesan bareng
                    </h2>
                    <Link
                      href="/menu"
                      className="shrink-0 text-sm font-medium text-accent-ink hover:underline"
                    >
                      Lihat semua
                    </Link>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {pilihanLain.map((menu) => (
                      <MenuCard key={menu.id} menu={menu} ringkas />
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ── janji layanan ── */}
          <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <ul className="grid gap-x-6 gap-y-5 border-t border-border pt-8 sm:grid-cols-2 lg:grid-cols-5">
              {JANJI.map(({ Ikon, judul, detail }) => (
                <li key={judul} className="flex gap-3">
                  <Ikon className="mt-0.5 size-5 shrink-0 text-accent" />
                  <div>
                    <p className="text-sm font-medium">{judul}</p>
                    <p className="mt-0.5 text-sm text-muted">{detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
