"use client";

import { useEffect, useState } from "react";
import { ApiError, getToken } from "@/lib/client-api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type Bukti = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
};

const ukuran = (bytes: number) =>
  bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;

/**
 * Unggah berkas bukti dan kembalikan datanya ke pemanggil.
 *
 * Berkas dikirim lebih dulu, sebelum dokumennya dibuat, lalu id-nya ikut
 * dikirim saat menyimpan nota. Dengan urutan itu penyimpanan nota bisa
 * menolak dirinya sendiri kalau buktinya tidak ada, tanpa perlu membuat nota
 * setengah jadi.
 */
export function UnggahBukti({
  bukti,
  onTambah,
  onHapus,
  wajib,
  keterangan,
}: {
  bukti: Bukti[];
  onTambah: (b: Bukti) => void;
  onHapus: (id: string) => void;
  wajib?: boolean;
  keterangan: string;
}) {
  const [sibuk, setSibuk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function unggah(file: File) {
    setSibuk(true);
    setError(null);

    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch(`${BASE}/api/attachments`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken() ?? ""}` },
        body: form,
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new ApiError(
          res.status,
          payload?.error?.message ?? "Gagal mengunggah berkas",
        );
      }

      onTambah((await res.json()) as Bukti);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal mengunggah berkas");
    } finally {
      setSibuk(false);
    }
  }

  return (
    <div>
      <p className="text-sm">
        <span className="font-medium">Bukti</span>
        {wajib ? (
          <span className="ml-1 text-accent-ink">wajib</span>
        ) : (
          <span className="ml-1 text-muted">opsional</span>
        )}
      </p>
      <p className="mt-0.5 text-sm text-muted">{keterangan}</p>

      {bukti.length > 0 && (
        <ul className="mt-3 space-y-2">
          {bukti.map((b) => (
            <li
              key={b.id}
              className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
            >
              <PratinjauBukti bukti={b} kecil />
              <span className="min-w-0 flex-1 truncate text-sm">
                {b.filename}
                <span className="text-muted"> · {ukuran(b.size)}</span>
              </span>
              <button
                type="button"
                onClick={() => onHapus(b.id)}
                className="text-sm text-muted hover:text-ink"
              >
                Hapus
              </button>
            </li>
          ))}
        </ul>
      )}

      <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:border-accent">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
          disabled={sibuk}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void unggah(file);
            e.target.value = "";
          }}
        />
        {sibuk ? "Mengunggah…" : "Pilih foto atau PDF"}
      </label>

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}

/**
 * Menampilkan isi berkas.
 *
 * Berkasnya diambil lewat fetch ber-token, bukan dipasang langsung sebagai
 * src, karena nota memuat nama supplier dan harga beli yang tidak boleh
 * terbuka untuk siapa saja yang menebak alamatnya.
 */
export function PratinjauBukti({
  bukti,
  kecil,
}: {
  bukti: Bukti;
  kecil?: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [gagal, setGagal] = useState(false);

  useEffect(() => {
    let dibatalkan = false;
    let objectUrl: string | null = null;

    fetch(`${BASE}/api/attachments/${bukti.id}/file`, {
      headers: { Authorization: `Bearer ${getToken() ?? ""}` },
    })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error("gagal"))))
      .then((blob) => {
        if (dibatalkan) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!dibatalkan) setGagal(true);
      });

    return () => {
      dibatalkan = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [bukti.id]);

  const pdf = bukti.mimeType === "application/pdf";

  if (kecil) {
    return (
      <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded bg-sunk text-[10px] text-muted">
        {pdf ? (
          "PDF"
        ) : url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="size-full object-cover" />
        ) : gagal ? (
          "?"
        ) : (
          "…"
        )}
      </span>
    );
  }

  if (gagal) {
    return (
      <p className="rounded-lg border border-border p-4 text-sm text-danger">
        Berkas bukti tidak bisa dimuat.
      </p>
    );
  }

  if (!url) {
    return (
      <p className="rounded-lg border border-border p-4 text-sm text-muted">
        Memuat bukti…
      </p>
    );
  }

  return (
    <figure>
      {pdf ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="block rounded-lg border border-border p-4 text-sm hover:border-accent"
        >
          Buka {bukti.filename} (PDF)
        </a>
      ) : (
        <a href={url} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={`Bukti ${bukti.filename}`}
            className="w-full rounded-lg border border-border"
          />
        </a>
      )}
      <figcaption className="mt-1 text-xs text-muted">
        {bukti.filename} · {ukuran(bukti.size)}
      </figcaption>
    </figure>
  );
}

/** Daftar bukti milik satu dokumen, diambil saat pop-up dibuka. */
export function DaftarBukti({
  refType,
  refId,
}: {
  refType: "purchase" | "waste" | "opname";
  refId: string;
}) {
  const [bukti, setBukti] = useState<Bukti[] | null>(null);

  useEffect(() => {
    let dibatalkan = false;

    fetch(
      `${BASE}/api/attachments?refType=${refType}&refId=${encodeURIComponent(refId)}`,
      { headers: { Authorization: `Bearer ${getToken() ?? ""}` } },
    )
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("gagal"))))
      .then((data: Bukti[]) => {
        if (!dibatalkan) setBukti(data);
      })
      .catch(() => {
        if (!dibatalkan) setBukti([]);
      });

    return () => {
      dibatalkan = true;
    };
  }, [refType, refId]);

  if (!bukti) return <p className="text-sm text-muted">Memuat bukti…</p>;

  if (bukti.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted">
        Tidak ada bukti terlampir. Catatan ini dibuat sebelum bukti diwajibkan,
        atau memang dilewati.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {bukti.map((b) => (
        <PratinjauBukti key={b.id} bukti={b} />
      ))}
    </div>
  );
}
