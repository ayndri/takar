import Image from "next/image";
import Link from "next/link";
import { MenuCard } from "@/components/menu-card";
import { getPublicMenus, type PublicMenu } from "@/lib/api";

// Beranda memuat sisa porsi yang berubah tiap pesanan masuk.
export const dynamic = "force-dynamic";

const FOTO_HERO =
  "https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=1000&q=75";

export default async function BerandaPage() {
  let menus: PublicMenu[] = [];
  let gagal = false;

  try {
    menus = await getPublicMenus();
  } catch {
    gagal = true;
  }

  const tersedia = menus.filter((m) => m.available);
  const kategori = [...new Set(menus.map((m) => m.category))].map((nama) => ({
    nama,
    jumlah: menus.filter((m) => m.category === nama).length,
    foto: menus.find((m) => m.category === nama && m.imageUrl)?.imageUrl ?? null,
  }));

  // Yang paling banyak sisa porsinya ditaruh di depan: itu yang paling aman
  // dipesan saat kafe ramai.
  const pilihan = [...tersedia]
    .sort((a, b) => b.remainingPortions - a.remainingPortions)
    .slice(0, 4);

  const menipis = tersedia
    .filter((m) => m.remainingPortions <= 5)
    .sort((a, b) => a.remainingPortions - b.remainingPortions);

  return (
    <main>
      <section className="mx-auto max-w-6xl px-4 pt-8 pb-12 sm:px-6 sm:pt-12">
        <div className="grid items-center gap-8 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-sm text-accent-ink">
              Pesan sendiri dari meja
            </p>

            <h1 className="mt-4 font-display text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Menu yang tahu
              <br />
              isi gudangnya.
            </h1>

            <p className="mt-4 max-w-md text-muted">
              Setiap gelas dihitung dari bahan yang benar-benar ada. Kalau susu
              tinggal sedikit, menunya menutup sendiri sebelum kamu sempat
              kecewa.
            </p>

            <form
              action="/menu"
              className="mt-6 flex max-w-md gap-2"
              role="search"
            >
              <input
                type="search"
                name="q"
                placeholder="Cari kopi, cokelat, teh…"
                aria-label="Cari menu"
                className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-sm"
              />
              <button
                type="submit"
                className="rounded-xl bg-accent px-5 py-3 text-sm font-medium text-white hover:bg-accent-ink"
              >
                Cari
              </button>
            </form>

            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <Link
                href="/menu"
                className="rounded-xl border border-ink px-4 py-2.5 font-medium hover:bg-ink hover:text-paper"
              >
                Lihat menu hari ini
              </Link>
              <Link
                href="/pesanan"
                className="rounded-xl px-4 py-2.5 text-muted hover:text-ink"
              >
                Lacak pesanan saya
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="relative aspect-4/3 overflow-hidden rounded-3xl bg-sunk">
              <Image
                src={FOTO_HERO}
                alt="Barista menuang susu ke dalam cangkir kopi"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 520px"
                className="object-cover"
              />
            </div>

            {/* Angka di kartu ini datang dari stok sungguhan, bukan hiasan. */}
            {!gagal && (
              <div className="absolute -bottom-5 left-4 rounded-2xl border border-border bg-surface px-4 py-3 shadow-sm sm:left-6">
                <p className="text-xs text-muted">Bisa dibuat sekarang</p>
                <p className="font-display text-2xl font-semibold">
                  {tersedia.length} dari {menus.length} menu
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {gagal ? (
        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <div className="rounded-2xl border border-border bg-surface p-6">
            <p className="font-medium text-accent-ink">Menu belum bisa dimuat</p>
            <p className="mt-1 text-sm text-muted">
              Layanan pesanan sedang tidak bisa dihubungi. Coba muat ulang
              halaman, atau pesan langsung ke kasir.
            </p>
          </div>
        </section>
      ) : menus.length === 0 ? (
        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <p className="font-display text-xl">Menu belum disusun</p>
            <p className="mt-1 text-sm text-muted">
              Belum ada menu aktif. Tanyakan ke kasir untuk pesanan hari ini.
            </p>
          </div>
        </section>
      ) : (
        <>
          <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
            <h2 className="font-display text-xl font-semibold">
              Mau yang mana?
            </h2>

            <ul className="mt-4 flex gap-3 overflow-x-auto pb-2">
              <li>
                <Link
                  href="/menu"
                  className="flex w-36 flex-col gap-2 rounded-2xl border border-border bg-surface p-3 hover:border-accent"
                >
                  <span className="grid size-12 place-items-center rounded-xl bg-accent-soft font-display text-lg font-semibold text-accent-ink">
                    {menus.length}
                  </span>
                  <span className="text-sm font-medium">Semua menu</span>
                  <span className="text-xs text-muted">
                    {tersedia.length} siap dibuat
                  </span>
                </Link>
              </li>

              {kategori.map((k) => (
                <li key={k.nama}>
                  <Link
                    href={`/menu?kategori=${encodeURIComponent(k.nama)}`}
                    className="flex w-36 flex-col gap-2 rounded-2xl border border-border bg-surface p-3 hover:border-accent"
                  >
                    <span className="relative size-12 overflow-hidden rounded-xl bg-sunk">
                      {k.foto && (
                        <Image
                          src={k.foto}
                          alt=""
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      )}
                    </span>
                    <span className="text-sm font-medium">{k.nama}</span>
                    <span className="text-xs text-muted">
                      {k.jumlah} pilihan
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
            <div className="flex items-baseline justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-semibold">
                  Paling aman dipesan
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Diurutkan dari yang bahannya paling banyak tersisa.
                </p>
              </div>
              <Link
                href="/menu"
                className="shrink-0 text-sm font-medium text-accent-ink hover:underline"
              >
                Lihat semua
              </Link>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {pilihan.map((menu) => (
                <MenuCard key={menu.id} menu={menu} />
              ))}
            </div>
          </section>

          <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
            <div className="grid gap-6 rounded-3xl bg-forest p-6 text-paper sm:p-8 lg:grid-cols-[1.2fr_1fr]">
              <div>
                <h2 className="font-display text-2xl font-semibold">
                  Kenapa menu bisa hilang sendiri
                </h2>
                <p className="mt-3 text-paper/85">
                  Tiap menu punya takaran bahan. Saat pesanan dikonfirmasi
                  kasir, bahan langsung dipotong dari catatan gudang. Begitu
                  salah satu bahan tidak cukup untuk satu porsi pun, menunya
                  ditandai habis di halaman ini, detik itu juga.
                </p>
                <p className="mt-3 text-paper/85">
                  Jadi yang kamu lihat di daftar memang bisa dibuat, bukan
                  sekadar tercetak di buku menu.
                </p>
              </div>

              {menipis.length > 0 ? (
                <div className="rounded-2xl bg-paper/10 p-4">
                  <p className="text-sm text-paper/80">Sedang menipis</p>
                  <ul className="mt-2 space-y-2">
                    {menipis.slice(0, 3).map((m) => (
                      <li key={m.id} className="flex justify-between gap-3">
                        <Link
                          href={`/menu/${m.id}`}
                          className="font-medium hover:underline"
                        >
                          {m.name}
                        </Link>
                        <span className="text-paper/80 tabular-nums">
                          {m.remainingPortions} porsi
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="rounded-2xl bg-paper/10 p-4">
                  <p className="text-sm text-paper/80">Sedang menipis</p>
                  <p className="mt-2 text-paper/85">
                    Tidak ada. Semua bahan masih cukup untuk lebih dari lima
                    porsi.
                  </p>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
