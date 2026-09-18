/**
 * Urutan tampil kategori.
 *
 * Bukan abjad: ini kafe kopi, jadi minuman didahulukan, lalu sarapan, makanan
 * berat, camilan, dan penutup. Kategori yang belum terdaftar di sini tetap
 * muncul, ditaruh di belakang.
 */
const URUTAN = [
  "Kopi",
  "Non-kopi",
  "Jus & Smoothie",
  "Sarapan",
  "Nasi",
  "Mie",
  "Roti & Burger",
  "Camilan",
  "Salad",
  "Manis",
];

export function urutkanKategori(kategori: string[]): string[] {
  return [...kategori].sort((a, b) => {
    const ia = URUTAN.indexOf(a);
    const ib = URUTAN.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b, "id");
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}
