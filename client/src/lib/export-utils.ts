import * as XLSX from "xlsx";
import { queryClient } from "@/lib/queryClient";

interface Branding {
  appName: string;
  logoData?: string | null;
  logoUrl?: string | null;
}

function getBranding(): Branding {
  const settings = queryClient.getQueryData<any>(["/api/settings"]);
  return {
    appName: settings?.appName || "TI Inventory",
    logoData: settings?.logoData || null,
    logoUrl: settings?.logoUrl || null,
  };
}

function getLogoSrc(b: Branding): string | null {
  if (b.logoData) return b.logoData;
  if (b.logoUrl) return b.logoUrl;
  return null;
}

// ── CSV ──────────────────────────────────────────────────────────────────────

export function downloadBrandedCSV(
  reportTitle: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string
) {
  const { appName } = getBranding();
  const dateStr = new Date().toLocaleString("pt-BR");
  const esc = (v: string | number) =>
    `"${String(v ?? "").replace(/"/g, '""')}"`;

  const lines = [
    `${esc(appName)}`,
    `${esc("Relatório: " + reportTitle)};${esc("Gerado em: " + dateStr)}`,
    "",
    headers.map(esc).join(";"),
    ...rows.map((r) => r.map((c) => esc(c)).join(";")),
  ].join("\r\n");

  const blob = new Blob(["\uFEFF" + lines], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── XLSX ─────────────────────────────────────────────────────────────────────

export function downloadBrandedXLSX(
  reportTitle: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string,
  sheetName = "Relatório"
) {
  const { appName } = getBranding();
  const dateStr = new Date().toLocaleString("pt-BR");

  const aoa: (string | number)[][] = [
    [appName],
    [reportTitle],
    [`Gerado em: ${dateStr}`],
    [],
    headers,
    ...rows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Merge title cell across all columns
  const colCount = headers.length;
  if (colCount > 1) {
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: colCount - 1 } },
    ];
  }

  // Auto-width columns — measure widest cell per column
  const maxWidths: number[] = headers.map((h) => h.length + 2);
  rows.forEach((row) => {
    row.forEach((cell, ci) => {
      const len = String(cell ?? "").length;
      if (len > (maxWidths[ci] ?? 0)) maxWidths[ci] = len;
    });
  });
  ws["!cols"] = maxWidths.map((w) => ({ wch: Math.min(w + 2, 60) }));

  // Row heights for branding rows
  ws["!rows"] = [
    { hpx: 22 }, // system name
    { hpx: 18 }, // report title
    { hpx: 14 }, // date
    { hpx: 8 },  // spacer
    { hpx: 16 }, // header row
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

// ── Multiple-sheet XLSX ───────────────────────────────────────────────────────

export interface XLSXSheet {
  name: string;
  headers: string[];
  rows: (string | number)[][];
}

export function downloadBrandedXLSXMulti(
  reportTitle: string,
  sheets: XLSXSheet[],
  filename: string
) {
  const { appName } = getBranding();
  const dateStr = new Date().toLocaleString("pt-BR");
  const wb = XLSX.utils.book_new();

  sheets.forEach(({ name, headers, rows }) => {
    const aoa: (string | number)[][] = [
      [appName],
      [reportTitle],
      [`Gerado em: ${dateStr}`],
      [],
      headers,
      ...rows,
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const colCount = headers.length;

    if (colCount > 1) {
      ws["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: colCount - 1 } },
      ];
    }

    const maxWidths: number[] = headers.map((h) => h.length + 2);
    rows.forEach((row) => {
      row.forEach((cell, ci) => {
        const len = String(cell ?? "").length;
        if (len > (maxWidths[ci] ?? 0)) maxWidths[ci] = len;
      });
    });
    ws["!cols"] = maxWidths.map((w) => ({ wch: Math.min(w + 2, 60) }));
    ws["!rows"] = [
      { hpx: 22 }, { hpx: 18 }, { hpx: 14 }, { hpx: 8 }, { hpx: 16 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, name.substring(0, 31));
  });

  XLSX.writeFile(wb, filename);
}

// ── PDF print with branded header ────────────────────────────────────────────

export function printWithBranding(reportTitle: string) {
  const b = getBranding();
  const logoSrc = getLogoSrc(b);
  const dateStr = new Date().toLocaleString("pt-BR");

  const headerId = "__export-print-header__";
  const styleId = "__export-print-style__";

  // Remove any stale injections
  document.getElementById(headerId)?.remove();
  document.getElementById(styleId)?.remove();

  // Build the header HTML
  const logoHtml = logoSrc
    ? `<img src="${logoSrc}" alt="logo" style="height:40px;width:40px;object-fit:contain;border-radius:8px;" />`
    : `<div style="height:40px;width:40px;background:#1e40af;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:bold;color:#fff;">TI</div>`;

  const header = document.createElement("div");
  header.id = headerId;
  header.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;padding:12px 0 8px;border-bottom:2px solid #1e40af;margin-bottom:16px;">
      ${logoHtml}
      <div>
        <div style="font-size:18px;font-weight:700;color:#1e3a8a;">${b.appName}</div>
        <div style="font-size:13px;color:#475569;">${reportTitle}</div>
      </div>
      <div style="margin-left:auto;text-align:right;font-size:11px;color:#94a3b8;">
        <div>Emitido em</div>
        <div style="font-weight:600;color:#475569;">${dateStr}</div>
      </div>
    </div>
  `;
  document.body.prepend(header);

  // Style: show header only on print, hide sidebar/buttons
  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    @media screen { #${headerId} { display: none !important; } }
    @media print {
      #${headerId} { display: block !important; }
      nav, aside, [data-no-print], .no-print, button { display: none !important; }
      body { font-size: 11px; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  `;
  document.head.appendChild(style);

  // Print and clean up
  setTimeout(() => {
    window.print();
    setTimeout(() => {
      document.getElementById(headerId)?.remove();
      document.getElementById(styleId)?.remove();
    }, 1000);
  }, 100);
}
