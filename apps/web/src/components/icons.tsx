/**
 * Ikon digambar sendiri, bukan diambil dari pustaka ikon umum.
 *
 * Tiap bentuk menunjuk hal yang benar-benar ada di aplikasi ini: gelas takar,
 * QR meja, kasir, catatan, dan jam operasional. Tidak ada kilau, bintang, atau
 * bentuk hiasan yang tidak mewakili apa pun.
 */

type Props = { className?: string };

const base = "size-5 stroke-current";

export function IconTakar({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" className={`${base} ${className}`}>
      <path d="M6 4h12l-1.2 14.5a2 2 0 0 1-2 1.5H9.2a2 2 0 0 1-2-1.5L6 4Z" />
      <path d="M7 9h10M7.4 13h9.2" strokeLinecap="round" />
    </svg>
  );
}

export function IconQR({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" className={`${base} ${className}`}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <path d="M14 14h3v3h-3zM19 19h2M14 21h2" strokeLinecap="round" />
    </svg>
  );
}

export function IconKasir({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" className={`${base} ${className}`}>
      <rect x="3" y="8" width="18" height="12" rx="2" />
      <path d="M7 8V5.5A1.5 1.5 0 0 1 8.5 4h7A1.5 1.5 0 0 1 17 5.5V8M8 13h3" strokeLinecap="round" />
    </svg>
  );
}

export function IconCatatan({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" className={`${base} ${className}`}>
      <path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v5h5M8.5 12h7M8.5 16h4" strokeLinecap="round" />
    </svg>
  );
}

export function IconJam({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" className={`${base} ${className}`}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" strokeLinecap="round" />
    </svg>
  );
}

export function IconKeranjang({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" className={`${base} ${className}`}>
      <path d="M4 6h2l1.6 9.2a2 2 0 0 0 2 1.8h6.9a2 2 0 0 0 2-1.6L20 9H7" strokeLinecap="round" />
      <circle cx="10" cy="20" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="17" cy="20" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconCari({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" className={`${base} ${className}`}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" strokeLinecap="round" />
    </svg>
  );
}

export function IconMeja({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" className={`${base} ${className}`}>
      <path d="M3 8h18M6 8v11M18 8v11M4.5 8 6 4.5h12L19.5 8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
