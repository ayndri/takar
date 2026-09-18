"use client";

/**
 * Select dengan tampilan yang sama di semua browser.
 *
 * Tanda panah bawaan sistem ukurannya berbeda-beda dan warnanya tidak bisa
 * diatur, jadi diganti panah sendiri. Daftar pilihannya tetap milik sistem
 * (itu yang bikin enak dipakai di HP), yang diganti hanya kotak tertutupnya.
 *
 * Varian `polos` dipakai saat select sudah berada di dalam kotak lain, seperti
 * di header dan di kolom pencarian hero, supaya tidak ada dua garis bertumpuk.
 */
export function Select({
  className = "",
  wrapperClassName = "",
  polos = false,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  wrapperClassName?: string;
  polos?: boolean;
}) {
  const dasar = polos
    ? "bg-transparent py-1 pr-6 pl-0 text-sm"
    : "w-full rounded-xl border border-border bg-surface py-2.5 pr-9 pl-3 text-sm";

  return (
    <span
      className={`relative inline-block ${polos ? "" : "w-full"} ${wrapperClassName}`}
    >
      <select
        {...props}
        className={`appearance-none text-ink outline-none ${dasar} ${className}`}
      >
        {children}
      </select>

      <svg
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
        className={`pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 stroke-muted ${
          polos ? "right-0.5" : "right-3"
        }`}
      >
        <path
          d="m6 8 4 4 4-4"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
