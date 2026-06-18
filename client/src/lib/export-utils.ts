// @ts-ignore — xlsx-js-style extends xlsx with cell styles
import XLSXStyle from "xlsx-js-style";
import { queryClient } from "@/lib/queryClient";

// ── Local cell-style type (xlsx-js-style doesn't ship TS declarations) ────────
interface CellStyle {
  fill?: { patternType?: string; fgColor?: { rgb: string }; bgColor?: { rgb: string } };
  font?: { bold?: boolean; sz?: number; color?: { rgb: string }; name?: string };
  alignment?: { horizontal?: string; vertical?: string; wrapText?: boolean };
  border?: {
    top?: { style: string; color?: { rgb: string } };
    bottom?: { style: string; color?: { rgb: string } };
    left?: { style: string; color?: { rgb: string } };
    right?: { style: string; color?: { rgb: string } };
  };
}

// ── Branding ──────────────────────────────────────────────────────────────────

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

// ── Color palette ─────────────────────────────────────────────────────────────
const C = {
  headerBg:    "1E3A8A", // dark navy — row 1 system name
  subHeaderBg: "1E40AF", // blue — row 2 report title
  dateBg:      "DBEAFE", // light blue — row 3 date
  colHeaderBg: "3B82F6", // medium blue — column headers
  rowAlt:      "F0F7FF", // very light blue — alternating rows
  white:       "FFFFFF",
  dark:        "1E293B", // slate-900
  mid:         "475569", // slate-600
  light:       "94A3B8", // slate-400
  border:      "CBD5E1", // slate-300
  borderDark:  "3B82F6", // blue for header border
};

// ── Style helpers ─────────────────────────────────────────────────────────────

function solidFill(rgb: string) {
  return { patternType: "solid" as const, fgColor: { rgb }, bgColor: { rgb } };
}

function headerRowStyle(sz = 14): CellStyle {
  return {
    fill: solidFill(C.headerBg),
    font: { bold: true, sz, color: { rgb: C.white }, name: "Calibri" },
    alignment: { horizontal: "left", vertical: "center", wrapText: false },
  };
}

function subHeaderRowStyle(): CellStyle {
  return {
    fill: solidFill(C.subHeaderBg),
    font: { bold: false, sz: 11, color: { rgb: C.white }, name: "Calibri" },
    alignment: { horizontal: "left", vertical: "center" },
  };
}

function dateRowStyle(): CellStyle {
  return {
    fill: solidFill(C.dateBg),
    font: { bold: false, sz: 10, color: { rgb: C.mid }, name: "Calibri" },
    alignment: { horizontal: "left", vertical: "center" },
  };
}

function colHeaderStyle(): CellStyle {
  return {
    fill: solidFill(C.colHeaderBg),
    font: { bold: true, sz: 10, color: { rgb: C.white }, name: "Calibri" },
    alignment: { horizontal: "center", vertical: "center", wrapText: false },
    border: {
      top:    { style: "thin", color: { rgb: C.borderDark } },
      bottom: { style: "thin", color: { rgb: C.borderDark } },
      left:   { style: "thin", color: { rgb: C.borderDark } },
      right:  { style: "thin", color: { rgb: C.borderDark } },
    },
  };
}

function dataRowStyle(rowIndex: number, isNumber = false): CellStyle {
  const bg = rowIndex % 2 === 0 ? C.white : C.rowAlt;
  return {
    fill: solidFill(bg),
    font: { sz: 10, color: { rgb: C.dark }, name: "Calibri" },
    alignment: {
      horizontal: isNumber ? "center" : "left",
      vertical: "center",
      wrapText: false,
    },
    border: {
      top:    { style: "hair", color: { rgb: C.border } },
      bottom: { style: "hair", color: { rgb: C.border } },
      left:   { style: "hair", color: { rgb: C.border } },
      right:  { style: "hair", color: { rgb: C.border } },
    },
  };
}

// ── Build styled worksheet ────────────────────────────────────────────────────

function buildStyledSheet(
  appName: string,
  reportTitle: string,
  headers: string[],
  rows: (string | number)[][]
): object {
  const dateStr = new Date().toLocaleString("pt-BR");
  const colCount = headers.length;

  // Build AOA (array of arrays) with cell objects carrying styles
  const makeCell = (v: string | number | null, style: CellStyle) => ({
    v: v ?? "",
    t: "s",
    s: style,
  });

  const numericCell = (v: string | number, style: CellStyle) => ({
    v: typeof v === "number" ? v : String(v),
    t: typeof v === "number" ? "n" : "s",
    s: style,
  });

  // Row 0 — System name
  const sysNameStyle = headerRowStyle(14);
  const row0 = [makeCell(appName, sysNameStyle), ...Array(colCount - 1).fill(makeCell("", sysNameStyle))];

  // Row 1 — Report title
  const subStyle = subHeaderRowStyle();
  const row1 = [makeCell(reportTitle, subStyle), ...Array(colCount - 1).fill(makeCell("", subStyle))];

  // Row 2 — Date
  const dateStyle = dateRowStyle();
  const row2 = [makeCell(`Gerado em: ${dateStr}`, dateStyle), ...Array(colCount - 1).fill(makeCell("", dateStyle))];

  // Row 3 — Spacer
  const spacerStyle: CellStyle = { fill: solidFill(C.dateBg) };
  const row3 = Array(colCount).fill(makeCell("", spacerStyle));

  // Row 4 — Column headers
  const row4 = headers.map((h) => makeCell(h, colHeaderStyle()));

  // Rows 5+ — Data
  const dataRows = rows.map((row, ri) =>
    row.map((cell, ci) => {
      const isNum = typeof cell === "number";
      const style = dataRowStyle(ri, isNum);
      return numericCell(cell, style);
    })
  );

  const aoa = [row0, row1, row2, row3, row4, ...dataRows];

  const ws = XLSXStyle.utils.aoa_to_sheet(aoa);

  // Merge branding rows across all columns
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: colCount - 1 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: colCount - 1 } },
  ];

  // Auto column widths
  const maxWidths: number[] = headers.map((h) => h.length + 2);
  rows.forEach((row) =>
    row.forEach((cell, ci) => {
      const len = String(cell ?? "").length;
      if (len > (maxWidths[ci] ?? 0)) maxWidths[ci] = len;
    })
  );
  ws["!cols"] = maxWidths.map((w) => ({ wch: Math.min(w + 2, 55) }));

  // Row heights
  ws["!rows"] = [
    { hpx: 28 }, // system name
    { hpx: 20 }, // report title
    { hpx: 16 }, // date
    { hpx: 6  }, // spacer
    { hpx: 20 }, // column headers
  ];

  return ws;
}

// ── Public: single-sheet XLSX ─────────────────────────────────────────────────

export function downloadBrandedXLSX(
  reportTitle: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string,
  sheetName = "Relatório"
) {
  const { appName } = getBranding();
  const ws = buildStyledSheet(appName, reportTitle, headers, rows);
  const wb = XLSXStyle.utils.book_new();
  XLSXStyle.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));
  XLSXStyle.writeFile(wb, filename);
}

// ── Public: multi-sheet XLSX ──────────────────────────────────────────────────

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
  const wb = XLSXStyle.utils.book_new();
  sheets.forEach(({ name, headers, rows }) => {
    const ws = buildStyledSheet(appName, reportTitle, headers, rows);
    XLSXStyle.utils.book_append_sheet(wb, ws, name.substring(0, 31));
  });
  XLSXStyle.writeFile(wb, filename);
}

// ── Public: branded CSV ───────────────────────────────────────────────────────

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

// ── Public: PDF print with branded header ────────────────────────────────────

export function printWithBranding(reportTitle: string) {
  const b = getBranding();
  const logoSrc = getLogoSrc(b);
  const dateStr = new Date().toLocaleString("pt-BR");

  const headerId = "__export-print-header__";
  const styleId  = "__export-print-style__";

  document.getElementById(headerId)?.remove();
  document.getElementById(styleId)?.remove();

  const logoHtml = logoSrc
    ? `<img src="${logoSrc}" alt="logo"
         style="height:44px;width:44px;object-fit:contain;border-radius:8px;border:1px solid #cbd5e1;" />`
    : `<div style="height:44px;width:44px;background:#1e3a8a;border-radius:8px;
                  display:flex;align-items:center;justify-content:center;
                  font-size:18px;font-weight:800;color:#fff;letter-spacing:-1px;">TI</div>`;

  const header = document.createElement("div");
  header.id = headerId;
  header.innerHTML = `
    <div style="
      display:flex;align-items:center;gap:14px;
      padding:14px 20px 12px;
      background:linear-gradient(135deg,#1e3a8a 0%,#1e40af 100%);
      border-radius:10px;margin-bottom:20px;
      box-shadow:0 2px 8px rgba(30,58,138,0.25);
    ">
      ${logoHtml}
      <div style="flex:1;">
        <div style="font-size:18px;font-weight:800;color:#fff;letter-spacing:-.3px;">${b.appName}</div>
        <div style="font-size:12px;color:#bfdbfe;margin-top:2px;">${reportTitle}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:9px;color:#93c5fd;text-transform:uppercase;letter-spacing:.5px;">Emitido em</div>
        <div style="font-size:11px;font-weight:600;color:#dbeafe;margin-top:2px;">${dateStr}</div>
      </div>
    </div>
  `;
  document.body.prepend(header);

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    @media screen { #${headerId} { display:none !important; } }
    @media print {
      #${headerId} { display:block !important; }
      nav, aside, header, [data-no-print], .no-print, button, [role="navigation"] { display:none !important; }
      body  { font-size:10px; margin:0; padding:12px; }
      table { width:100%; border-collapse:collapse; font-size:9.5px; }
      th    { background:#3b82f6 !important; color:#fff !important; padding:5px 8px;
              font-weight:700; text-align:left; }
      td    { padding:4px 8px; border-bottom:1px solid #e2e8f0; }
      tr:nth-child(even) td { background:#f0f7ff !important; }
      * { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      @page { margin:15mm; }
    }
  `;
  document.head.appendChild(style);

  setTimeout(() => {
    window.print();
    setTimeout(() => {
      document.getElementById(headerId)?.remove();
      document.getElementById(styleId)?.remove();
    }, 1500);
  }, 120);
}
