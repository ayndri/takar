/**
 * Indikator sisa porsi berbentuk garis takaran.
 *
 * Motif ini dipakai berulang (kartu menu, halaman detail) supaya nama produk
 * punya wujud visual, dan supaya sisa stok bisa dibaca sekilas tanpa angka.
 */
export function Takaran({
  sisa,
  penuh = 12,
}: {
  sisa: number;
  penuh?: number;
}) {
  const batang = 8;
  const nyala = Math.min(batang, Math.ceil((sisa / penuh) * batang));

  return (
    <span
      className="takaran"
      role="img"
      aria-label={`Sisa ${sisa} porsi`}
      title={`Sisa ${sisa} porsi`}
    >
      {Array.from({ length: batang }, (_, i) => (
        <span
          key={i}
          data-off={i >= nyala}
          style={{ height: `${6 + i * 1}px` }}
        />
      ))}
    </span>
  );
}
