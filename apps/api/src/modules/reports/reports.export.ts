import ExcelJS from 'exceljs'
import {
  inventoryValue,
  menuMargins,
  salesSummary,
  salesTrend,
  wasteSummary,
} from './reports.service.js'

/**
 * Laporan dalam satu berkas Excel.
 *
 * Excel, bukan PDF. Pemilik kafe yang mengunduh laporan hampir selalu mau
 * mengurutkan, menjumlah, atau menempelkannya ke hitungan lain. PDF
 * mengunci angkanya jadi gambar dan menghalangi semua itu; untuk sekadar
 * mencetak, Ctrl+P dari halaman laporan sudah cukup.
 *
 * Satu berkas berisi beberapa lembar, bukan beberapa berkas. Yang dibuka
 * orang berikutnya biasanya "laporan bulan ini", bukan "lembar waste bulan
 * ini" yang terpisah dari konteksnya.
 */

const RUPIAH = '#,##0'
const RUPIAH_SEN = '#,##0.00'

type Kolom = {
  header: string
  key: string
  width: number
  /** Format angka Excel, mis. RUPIAH. Kosong berarti teks biasa. */
  format?: string
}

/**
 * Buat satu lembar beserta kepala tabel yang sudah dirapikan.
 *
 * Baris kepalanya dibekukan supaya tetap terlihat saat digulir. Lembar
 * laporan yang panjang tanpa itu memaksa orang menggulir balik ke atas
 * cuma untuk mengingat kolom ketiga itu apa.
 */
function buatLembar(wb: ExcelJS.Workbook, nama: string, kolom: Kolom[]) {
  const ws = wb.addWorksheet(nama, {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  ws.columns = kolom.map((k) => ({
    header: k.header,
    key: k.key,
    width: k.width,
    style: k.format ? { numFmt: k.format } : undefined,
  }))

  const kepala = ws.getRow(1)
  kepala.font = { bold: true }
  kepala.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF4F4F5' },
  }
  kepala.border = { bottom: { style: 'thin', color: { argb: 'FFE8E6E3' } } }

  return ws
}

export type RentangLaporan = { from?: string; to?: string }

export async function buatLaporanExcel(rentang: RentangLaporan) {
  const [tren, ringkas, waste, persediaan, margin] = await Promise.all([
    salesTrend(rentang),
    salesSummary(rentang),
    wasteSummary(rentang),
    inventoryValue(),
    menuMargins(),
  ])

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Takar'
  wb.created = new Date()

  // ── ringkasan ──
  const ws = wb.addWorksheet('Ringkasan', { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = [
    { header: 'Keterangan', key: 'k', width: 32 },
    { header: 'Nilai', key: 'v', width: 20 },
  ]
  ws.getRow(1).font = { bold: true }

  const periode =
    rentang.from || rentang.to
      ? `${rentang.from?.slice(0, 10) ?? 'awal'} s/d ${rentang.to?.slice(0, 10) ?? 'sekarang'}`
      : 'Seluruh riwayat'

  const baris: [string, string | number, string?][] = [
    ['Periode', periode],
    ['Jumlah pesanan', ringkas.orderCount],
    ['Omzet', Number(ringkas.revenue), RUPIAH],
    ['HPP', Number(ringkas.cogs), RUPIAH],
    ['Laba kotor', Number(ringkas.grossProfit), RUPIAH],
    ['Margin (%)', Number(ringkas.marginPercent)],
    ['Nilai persediaan sekarang', Number(persediaan.total), RUPIAH],
    ['Bahan di bawah stok minimum', persediaan.lowCount],
    ['Nilai terbuang', Number(waste.total), RUPIAH],
    ['Jumlah catatan waste', waste.count],
  ]

  for (const [k, v, fmt] of baris) {
    const r = ws.addRow({ k, v })
    if (fmt) r.getCell('v').numFmt = fmt
  }

  // ── penjualan harian ──
  const wsHarian = buatLembar(wb, 'Penjualan harian', [
    { header: 'Tanggal', key: 'date', width: 14 },
    { header: 'Pesanan', key: 'orders', width: 10 },
    { header: 'Omzet', key: 'revenue', width: 16, format: RUPIAH },
    { header: 'HPP', key: 'cogs', width: 16, format: RUPIAH },
    { header: 'Laba kotor', key: 'profit', width: 16, format: RUPIAH },
  ])

  for (const d of tren) {
    wsHarian.addRow({
      date: d.date,
      orders: d.orderCount,
      revenue: Number(d.revenue),
      cogs: Number(d.cogs),
      profit: Number(d.grossProfit),
    })
  }

  // Baris jumlah memakai rumus SUM, bukan angka mati: yang membukanya bisa
  // menyaring atau menghapus baris dan jumlahnya ikut menyesuaikan.
  if (tren.length > 0) {
    const akhir = tren.length + 1
    const total = wsHarian.addRow({
      date: 'Jumlah',
      orders: { formula: `SUM(B2:B${akhir})` },
      revenue: { formula: `SUM(C2:C${akhir})` },
      cogs: { formula: `SUM(D2:D${akhir})` },
      profit: { formula: `SUM(E2:E${akhir})` },
    })
    total.font = { bold: true }
  }

  // ── menu terlaris ──
  const wsMenu = buatLembar(wb, 'Menu terlaris', [
    { header: 'Menu', key: 'name', width: 32 },
    { header: 'Porsi terjual', key: 'qty', width: 14 },
    { header: 'Omzet', key: 'revenue', width: 16, format: RUPIAH },
  ])

  for (const m of ringkas.topMenus) {
    wsMenu.addRow({ name: m.name, qty: m.qty, revenue: Number(m.revenue) })
  }

  // ── margin per menu ──
  const wsMargin = buatLembar(wb, 'Margin per menu', [
    { header: 'Menu', key: 'name', width: 32 },
    { header: 'Kategori', key: 'category', width: 18 },
    { header: 'Harga berlaku', key: 'price', width: 16, format: RUPIAH },
    { header: 'Harga normal', key: 'normal', width: 16, format: RUPIAH },
    { header: 'HPP', key: 'cost', width: 16, format: RUPIAH_SEN },
    { header: 'Laba', key: 'profit', width: 16, format: RUPIAH_SEN },
    { header: 'Margin (%)', key: 'margin', width: 12 },
  ])

  for (const m of margin) {
    wsMargin.addRow({
      name: m.name,
      category: m.category,
      price: Number(m.price),
      normal: m.normalPrice === null ? '' : Number(m.normalPrice),
      cost: Number(m.cost),
      profit: Number(m.profit),
      margin: Number(m.marginPercent),
    })
  }

  // ── waste ──
  const wsWaste = buatLembar(wb, 'Waste', [
    { header: 'Bahan', key: 'name', width: 28 },
    { header: 'Jumlah', key: 'qty', width: 14 },
    { header: 'Satuan', key: 'unit', width: 10 },
    { header: 'Nilai', key: 'value', width: 16, format: RUPIAH },
  ])

  for (const i of waste.topIngredients) {
    wsWaste.addRow({
      name: i.name,
      qty: Number(i.qty),
      unit: i.baseUnit.toLowerCase(),
      value: Number(i.value),
    })
  }

  // ── persediaan ──
  const wsStok = buatLembar(wb, 'Persediaan', [
    { header: 'Bahan', key: 'name', width: 28 },
    { header: 'Sisa', key: 'qty', width: 14 },
    { header: 'Satuan', key: 'unit', width: 10 },
    { header: 'Nilai', key: 'value', width: 16, format: RUPIAH },
    { header: 'Di bawah minimum', key: 'low', width: 18 },
  ])

  for (const i of persediaan.items) {
    wsStok.addRow({
      name: i.name,
      qty: Number(i.qty),
      unit: i.baseUnit.toLowerCase(),
      value: Number(i.value),
      low: i.isLow ? 'ya' : '',
    })
  }

  const buffer = await wb.xlsx.writeBuffer()

  return {
    buffer: Buffer.from(buffer),
    nama: `takar-laporan-${new Date().toISOString().slice(0, 10)}.xlsx`,
  }
}
