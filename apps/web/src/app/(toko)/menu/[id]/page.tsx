import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCart } from "@/components/add-to-cart";
import { MenuCard } from "@/components/menu-card";
import { Takaran } from "@/components/takaran";
import {
  api,
  formatRupiah,
  getPublicMenus,
  type PublicMenu,
} from "@/lib/api";

export const dynamic = "force-dynamic";

type MenuDetail = {
  id: string;
  name: string;
  category: string;
  price: string;
  imageUrl: string | null;
  isActive: boolean;
  remainingPortions: number;
  ingredients: string[];
};

export default async function DetailMenuPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let menu: MenuDetail;
  let lainnya: PublicMenu[] = [];

  try {
    menu = await api<MenuDetail>(`/api/menus/${id}`);
  } catch {
    notFound();
  }

  try {
    // Ambil empat dari kategori yang sama, lalu buang menu yang sedang dibuka.
    const sekategori = await getPublicMenus({
      category: menu.category,
      pageSize: 4,
    });
    lainnya = sekategori.items.filter((m) => m.id !== menu.id).slice(0, 3);
  } catch {
    lainnya = [];
  }

  const habis = menu.remainingPortions === 0;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <nav className="text-sm text-muted">
        <Link href="/menu" className="hover:text-ink">
          Menu
        </Link>
        <span className="px-2">/</span>
        <Link
          href={`/menu?kategori=${encodeURIComponent(menu.category)}`}
          className="hover:text-ink"
        >
          {menu.category}
        </Link>
      </nav>

      <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_1fr]">
        <div className="relative aspect-4/3 overflow-hidden rounded-3xl bg-sunk">
          {menu.imageUrl ? (
            <Image
              src={menu.imageUrl}
              alt=""
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 560px"
              className={`object-cover ${habis ? "grayscale" : ""}`}
            />
          ) : (
            <div className="grid h-full place-items-center font-display text-6xl text-muted">
              {menu.name.charAt(0)}
            </div>
          )}
        </div>

        <div>
          <p className="text-sm tracking-wide text-muted">{menu.category}</p>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">
            {menu.name}
          </h1>

          <p className="mt-3 font-display text-2xl font-semibold tabular-nums">
            {formatRupiah(menu.price)}
          </p>

          <div className="mt-5 rounded-2xl border border-border bg-surface p-4">
            {habis ? (
              <>
                <p className="font-medium text-accent-ink">Bahannya habis</p>
                <p className="mt-1 text-sm text-muted">
                  Menu ini muncul lagi begitu bahannya masuk. Sementara itu,
                  lihat pilihan lain di bawah.
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <Takaran sisa={menu.remainingPortions} />
                  <p className="text-sm">
                    Cukup untuk{" "}
                    <span className="font-medium">
                      {menu.remainingPortions} porsi
                    </span>{" "}
                    lagi
                  </p>
                </div>
                <p className="mt-2 text-sm text-muted">
                  Dihitung dari bahan yang tersisa di gudang, bukan perkiraan.
                </p>
              </>
            )}
          </div>

          {menu.ingredients.length > 0 && (
            <div className="mt-5">
              <h2 className="text-sm font-medium">Dibuat dari</h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {menu.ingredients.map((bahan) => (
                  <li
                    key={bahan}
                    className="rounded-lg bg-sunk px-2.5 py-1 text-sm text-muted"
                  >
                    {bahan}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6">
            <AddToCart
              menuId={menu.id}
              name={menu.name}
              price={menu.price}
              maksimal={menu.remainingPortions}
            />
          </div>
        </div>
      </div>

      {lainnya.length > 0 && (
        <section className="mt-14">
          <h2 className="font-display text-2xl font-semibold">
            {menu.category} lainnya
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lainnya.map((m) => (
              <MenuCard key={m.id} menu={m} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
