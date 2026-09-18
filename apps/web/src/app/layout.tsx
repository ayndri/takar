import type { Metadata } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

/*
  Fraunces untuk judul: serif dengan sudut lembut yang terasa seperti papan
  menu tulis tangan, bukan dasbor perangkat lunak.
  Plus Jakarta Sans untuk teks: dirancang untuk bahasa Indonesia, jadi huruf
  berulang seperti "ng" dan "ny" tetap enak dibaca dalam ukuran kecil.
*/
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Takar, pesan dari meja",
  description:
    "Menu kafe yang tahu isi gudangnya sendiri. Bahan habis, menunya ikut tutup.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${fraunces.variable} ${jakarta.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
