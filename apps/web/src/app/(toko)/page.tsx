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
import { HeroKartu } from "@/components/hero-kartu";
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

  /** Yang nomor satu naik ke kartu hero; sisanya mengisi bagian di bawahnya. */
  const unggulan = terlaris[0];
  const populer = terlaris.slice(1, 4);
  const sorotan = terlaris[4];
  const pilihanLain = terlaris.slice(5, 11);
  const menipis = tersedia
    .filter((m) => m.remainingPortions <= 5)
    .sort((a, b) => a.remainingPortions - b.remainingPortions);

  return (
    <main>
      {/* ── hero ──
          Fotonya tidak lagi ditutup lapisan putih. Teks berdiri di kolomnya
          sendiri di atas latar bersih, foto mendapat kolom penuh di sebelahnya,
          dan satu kartu menu mengambang di perbatasan keduanya supaya ada
          kedalaman sekaligus barang yang benar-benar bisa dipesan. */}
      <section className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 sm:pt-10">
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.05fr] lg:gap-10">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent-ink">
              <span className="size-1.5 rounded-full bg-accent" />
              Pesan sendiri dari meja
            </p>

            <h1 className="mt-5 font-display text-5xl leading-[0.98] font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl">
              Makan enak,
              <br />
              <span className="text-accent">takarannya pas.</span>
            </h1>

            <p className="mt-5 max-w-md text-lg text-muted">
              {menus.length} menu, dari kopi sampai nasi goreng, diracik setelah
              kamu pesan. Yang tampil di daftar cuma yang bahannya benar-benar
              ada di dapur.
            </p>

            <div className="mt-7">
              <HeroSearch />
            </div>

            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <Link
                href="/menu"
                className="rounded-xl bg-accent px-6 py-3.5 font-medium text-white transition hover:bg-accent-ink"
              >
                Lihat menu hari ini
              </Link>
              <Link
                href="/pesanan"
                className="rounded-xl border border-border bg-surface px-6 py-3.5 font-medium transition hover:border-accent"
              >
                Lacak pesanan
              </Link>
            </div>

            {!gagal && (
              <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-3 border-t border-border pt-6">
                <div>
                  <dt className="text-sm text-muted">Bisa dibuat sekarang</dt>
                  <dd className="font-display text-2xl font-semibold">
                    {tersedia.length}
                    <span className="text-muted"> / {menus.length} menu</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted">Kategori</dt>
                  <dd className="font-display text-2xl font-semibold">
                    {kategori.length}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted">Terjual minggu ini</dt>
                  <dd className="font-display text-2xl font-semibold">
                    {menus.reduce((s, m) => s + m.soldThisWeek, 0)} porsi
                  </dd>
                </div>
              </dl>
            )}
          </div>

          <div className="relative">
            <div className="relative aspect-4/5 overflow-hidden rounded-[2rem] bg-sunk sm:aspect-16/11 lg:aspect-4/5">
              <Image
                src={FOTO_HERO}
                alt="Meja kafe dengan kopi dan makanan yang baru disajikan"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 560px"
                className="object-cover"
              />
            </div>

            {unggulan && (
              <div className="absolute -bottom-5 -left-3 hidden sm:block lg:-left-10">
                <HeroKartu menu={unggulan} />
              </div>
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

            {/* Grid yang membungkus, bukan baris yang digeser: sebelas kartu
                cuma sedikit lebih lebar dari kontainernya, dan menyisakan
                satu batang geser untuk selisih sekecil itu lebih mengganggu
                daripada membuatnya turun ke baris berikutnya.
                Tinggi kartu dikunci dan label dibatasi dua baris supaya nama
                panjang seperti "Jus & Smoothie" tidak menaikkan barisnya. */}
            <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-11">
              <li>
                <Link
                  href="/menu"
                  className="flex h-[116px] w-full flex-col items-center gap-2 rounded-2xl border border-accent bg-accent-soft px-1.5 pt-3 text-center"
                >
                  <span className="grid size-12 shrink-0 place-items-center rounded-full bg-surface font-display text-base font-semibold text-accent-ink">
                    {menus.length}
                  </span>
                  <span className="text-xs leading-snug font-medium text-accent-ink">
                    Semua
                  </span>
                </Link>
              </li>

              {kategori.map((k) => (
                <li key={k.nama}>
                  <Link
                    href={`/menu?kategori=${encodeURIComponent(k.nama)}`}
                    className="flex h-[116px] w-full flex-col items-center gap-2 rounded-2xl border border-border bg-surface px-1.5 pt-3 text-center transition hover:border-accent"
                  >
                    <span className="relative size-12 shrink-0 overflow-hidden rounded-full bg-sunk">
                      {k.foto && (
                        <Image
                          src={`https://images.unsplash.com/${k.foto}?w=140&q=70`}
                          alt=""
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      )}
                    </span>
                    <span className="line-clamp-2 text-xs leading-snug font-medium text-balance">
                      {k.nama}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* ── populer + panel ──
              Diberi latar abu tipis supaya halaman punya jeda: tanpa itu
              semua bagian menyatu jadi satu bidang putih panjang. */}
          <section className="mt-14 bg-sunk py-12">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="flex items-baseline justify-between gap-4">
              <div>
                <h2 className="font-display text-3xl font-semibold tracking-tight">
                  Paling laku minggu ini
                </h2>
                <p className="mt-1.5 text-muted">
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

            <div className="mt-6 grid gap-4 lg:grid-cols-4">
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
            </div>
          </section>

          {/* ── status pesanan berjalan ── */}
          <section className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
            <ActiveOrderBar />
          </section>

          {/* ── sorotan + pilihan ── */}
          {sorotan && (
            <section className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
              <div className="grid gap-4 lg:grid-cols-[1.1fr_1.4fr]">
                <article className="overflow-hidden rounded-3xl border border-border bg-surface">
                  <div className="relative aspect-4/3">
                    {sorotan.imageUrl && (
                      <Image
                        src={sorotan.imageUrl}
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
                    <p className="text-xs text-muted">{sorotan.category}</p>
                    <h3 className="mt-1 font-display text-2xl font-semibold">
                      {sorotan.name}
                    </h3>
                    <p className="mt-1 text-sm text-muted">
                      Terjual {sorotan.soldThisWeek} porsi tujuh hari terakhir,
                      dari {sorotan.ingredientCount} bahan.
                    </p>

                    <div className="mt-4 flex items-center gap-3">
                      <Takaran sisa={sorotan.remainingPortions} />
                      <span className="text-sm text-muted">
                        sisa {sorotan.remainingPortions} porsi
                      </span>
                    </div>

                    <div className="mt-5 flex items-center justify-between gap-4">
                      <span className="font-display text-2xl font-semibold tabular-nums">
                        {formatRupiah(sorotan.price)}
                      </span>
                      <PilihanUtama menu={sorotan} />
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

          {/* ── janji layanan ──
              Dijadikan kartu, bukan lima kolom teks telanjang: dengan kotak
              dan ikon berlatar, baris ini terbaca sebagai satu bagian yang
              disengaja, bukan sisa teks di kaki halaman. */}
          <section className="mx-auto max-w-6xl px-4 pt-14 sm:px-6">
            <h2 className="font-display text-3xl font-semibold tracking-tight">
              Yang kamu dapat di sini
            </h2>

            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {JANJI.map(({ Ikon, judul, detail }) => (
                <li
                  key={judul}
                  className="rounded-2xl border border-border bg-surface p-4"
                >
                  <span className="grid size-10 place-items-center rounded-xl bg-accent-soft">
                    <Ikon className="size-5 text-accent-ink" />
                  </span>
                  <p className="mt-3 font-medium">{judul}</p>
                  <p className="mt-1 text-sm text-muted">{detail}</p>
                </li>
              ))}
            </ul>
          </section>

          {/* ── penutup ──
              Halaman perlu berakhir dengan satu ajakan, bukan berhenti begitu
              saja. Foto di kanan diambil dari menu yang sedang tersedia, jadi
              blok ini ikut berubah mengikuti isi dapur. */}
          <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <div className="overflow-hidden rounded-3xl bg-forest">
              <div className="grid items-center gap-8 p-7 sm:p-10 lg:grid-cols-[1.1fr_1fr]">
                <div className="text-paper">
                  <h2 className="font-display text-3xl leading-tight font-semibold text-balance sm:text-4xl">
                    Sudah duduk? Tinggal pesan.
                  </h2>
                  <p className="mt-3 max-w-md text-paper/85">
                    Pilih nomor meja, susun pesanan, lalu bayar di kasir saat
                    minumanmu siap. Tidak perlu daftar akun, tidak perlu antre
                    di depan.
                  </p>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link
                      href="/menu"
                      className="rounded-xl bg-paper px-6 py-3.5 font-medium text-forest transition hover:bg-paper/90"
                    >
                      Buka daftar menu
                    </Link>
                    <Link
                      href="/pesanan"
                      className="rounded-xl border border-paper/30 px-6 py-3.5 font-medium text-paper transition hover:border-paper/60"
                    >
                      Lacak pesanan
                    </Link>
                  </div>
                </div>

                <ul className="grid grid-cols-2 gap-3">
                  {terlaris.slice(0, 4).map((m) => (
                    <li key={m.id}>
                      <Link
                        href={`/menu/${m.id}`}
                        className="group block overflow-hidden rounded-2xl bg-paper/10"
                      >
                        <span className="relative block aspect-4/3">
                          {m.imageUrl && (
                            <Image
                              src={m.imageUrl}
                              alt=""
                              fill
                              sizes="(max-width: 1024px) 45vw, 200px"
                              className="object-cover transition duration-300 group-hover:scale-105"
                            />
                          )}
                        </span>
                        <span className="block px-3 py-2 text-sm font-medium text-paper">
                          {m.name}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
