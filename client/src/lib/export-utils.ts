// @ts-ignore — xlsx-js-style has no TS declarations
import XLSXStyle from "xlsx-js-style";
import { queryClient } from "@/lib/queryClient";

// ── Local cell-style type ─────────────────────────────────────────────────────
interface CellStyle {
  fill?: { patternType?: string; fgColor?: { rgb: string }; bgColor?: { rgb: string } };
  font?: { bold?: boolean; sz?: number; color?: { rgb: string }; name?: string };
  alignment?: { horizontal?: string; vertical?: string; wrapText?: boolean };
  border?: {
    top?:    { style: string; color?: { rgb: string } };
    bottom?: { style: string; color?: { rgb: string } };
    left?:   { style: string; color?: { rgb: string } };
    right?:  { style: string; color?: { rgb: string } };
  };
}

// ── Color utilities ───────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace(/^#/, "").padEnd(6, "0");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn: h = (gn - bn) / d + (gn < bn ? 6 : 0); break;
      case gn: h = (bn - rn) / d + 2; break;
      case bn: h = (rn - gn) / d + 4; break;
    }
    h /= 6;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h: number, s: number, l: number): string {
  const sn = s / 100, ln = l / 100;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = ln - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

/** Derive 6-char hex variants from a primary hex color */
function buildPalette(primaryHex: string) {
  const safe = /^#?[0-9A-Fa-f]{6}$/.test(primaryHex)
    ? primaryHex
    : "#0ea5e9";

  const [r, g, b] = hexToRgb(safe);
  const [h, s]    = rgbToHsl(r, g, b);

  // Clamp saturation so very desaturated colors still look good
  const si = Math.max(s, 40);

  return {
    headerBg:    hslToHex(h, si,  22), // very dark  — row 1 system name
    subHeaderBg: hslToHex(h, si,  35), // dark       — row 2 report title
    dateBg:      hslToHex(h, 60,  94), // very light — row 3 date
    colHeaderBg: hslToHex(h, si,  48), // primary    — column headers
    rowAlt:      hslToHex(h, 40,  97), // near-white — alternating rows
    accent:      hslToHex(h, si,  60), // for borders
    white:       "FFFFFF",
    dark:        "1E293B",
    mid:         "475569",
    border:      "CBD5E1",
  };
}

// ── Branding resolver ─────────────────────────────────────────────────────────

interface Branding {
  appName:      string;
  primaryColor: string;
  logoData?:    string | null;
  logoUrl?:     string | null;
}

function getBranding(): Branding {
  const s = queryClient.getQueryData<any>(["/api/settings"]);
  return {
    appName:      s?.appName      || "TI Inventory",
    primaryColor: s?.primaryColor || "#0ea5e9",
    logoData:     s?.logoData     || null,
    logoUrl:      s?.logoUrl      || null,
  };
}

function getLogoSrc(b: Branding): string | null {
  return b.logoData || b.logoUrl || null;
}

// ── Styled worksheet builder ──────────────────────────────────────────────────

function solidFill(rgb: string): CellStyle["fill"] {
  return { patternType: "solid", fgColor: { rgb }, bgColor: { rgb } };
}

function buildStyledSheet(
  b: Branding,
  reportTitle: string,
  headers: string[],
  rows: (string | number)[][]
): object {
  const C = buildPalette(b.primaryColor);
  const dateStr   = new Date().toLocaleString("pt-BR");
  const colCount  = headers.length;

  // ── Style factories ──
  const sysNameStyle: CellStyle = {
    fill:      solidFill(C.headerBg),
    font:      { bold: true, sz: 14, color: { rgb: C.white }, name: "Calibri" },
    alignment: { horizontal: "left", vertical: "center" },
  };
  const subHeaderStyle: CellStyle = {
    fill:      solidFill(C.subHeaderBg),
    font:      { bold: false, sz: 11, color: { rgb: C.white }, name: "Calibri" },
    alignment: { horizontal: "left", vertical: "center" },
  };
  const dateStyle: CellStyle = {
    fill:      solidFill(C.dateBg),
    font:      { bold: false, sz: 10, color: { rgb: C.mid }, name: "Calibri" },
    alignment: { horizontal: "left", vertical: "center" },
  };
  const spacerStyle: CellStyle = { fill: solidFill(C.dateBg) };
  const colHeaderStyle: CellStyle = {
    fill:      solidFill(C.colHeaderBg),
    font:      { bold: true, sz: 10, color: { rgb: C.white }, name: "Calibri" },
    alignment: { horizontal: "center", vertical: "center" },
    border: {
      top:    { style: "thin",  color: { rgb: C.accent } },
      bottom: { style: "thin",  color: { rgb: C.accent } },
      left:   { style: "thin",  color: { rgb: C.accent } },
      right:  { style: "thin",  color: { rgb: C.accent } },
    },
  };

  const dataStyle = (ri: number, isNum = false): CellStyle => ({
    fill:      solidFill(ri % 2 === 0 ? C.white : C.rowAlt),
    font:      { sz: 10, color: { rgb: C.dark }, name: "Calibri" },
    alignment: { horizontal: isNum ? "center" : "left", vertical: "center" },
    border: {
      top:    { style: "hair", color: { rgb: C.border } },
      bottom: { style: "hair", color: { rgb: C.border } },
      left:   { style: "hair", color: { rgb: C.border } },
      right:  { style: "hair", color: { rgb: C.border } },
    },
  });

  const cell = (v: string | number | null, style: CellStyle) => ({
    v: v ?? "", t: "s", s: style,
  });
  const numCell = (v: string | number, style: CellStyle) => ({
    v: typeof v === "number" ? v : String(v),
    t: typeof v === "number" ? "n" : "s",
    s: style,
  });

  const blank = (style: CellStyle) => cell("", style);
  const blankRow = (style: CellStyle) => Array(colCount).fill(blank(style));

  // ── Build rows ──
  const row0 = [cell(b.appName, sysNameStyle),   ...blankRow(sysNameStyle).slice(1)];
  const row1 = [cell(reportTitle, subHeaderStyle),...blankRow(subHeaderStyle).slice(1)];
  const row2 = [cell(`Gerado em: ${dateStr}`, dateStyle), ...blankRow(dateStyle).slice(1)];
  const row3 = blankRow(spacerStyle);
  const row4 = headers.map((h) => cell(h, colHeaderStyle));
  const dataRows = rows.map((row, ri) =>
    row.map((v, ci) => numCell(v, dataStyle(ri, typeof v === "number")))
  );

  const aoa = [row0, row1, row2, row3, row4, ...dataRows];
  const ws  = XLSXStyle.utils.aoa_to_sheet(aoa);

  // Merge branding rows
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: colCount - 1 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: colCount - 1 } },
  ];

  // Auto column widths
  const maxW: number[] = headers.map((h) => h.length + 2);
  rows.forEach((row) =>
    row.forEach((v, ci) => {
      const len = String(v ?? "").length;
      if (len > (maxW[ci] ?? 0)) maxW[ci] = len;
    })
  );
  ws["!cols"] = maxW.map((w) => ({ wch: Math.min(w + 2, 55) }));
  ws["!rows"] = [
    { hpx: 28 }, { hpx: 20 }, { hpx: 16 }, { hpx: 6 }, { hpx: 20 },
  ];

  return ws;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function downloadBrandedXLSX(
  reportTitle: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string,
  sheetName = "Relatório"
) {
  const b  = getBranding();
  const ws = buildStyledSheet(b, reportTitle, headers, rows);
  const wb = XLSXStyle.utils.book_new();
  XLSXStyle.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));
  XLSXStyle.writeFile(wb, filename);
}

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
  const b  = getBranding();
  const wb = XLSXStyle.utils.book_new();
  sheets.forEach(({ name, headers, rows }) => {
    const ws = buildStyledSheet(b, reportTitle, headers, rows);
    XLSXStyle.utils.book_append_sheet(wb, ws, name.substring(0, 31));
  });
  XLSXStyle.writeFile(wb, filename);
}

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
    esc(appName),
    `${esc("Relatório: " + reportTitle)};${esc("Gerado em: " + dateStr)}`,
    "",
    headers.map(esc).join(";"),
    ...rows.map((r) => r.map((c) => esc(c)).join(";")),
  ].join("\r\n");

  const blob = new Blob(["\uFEFF" + lines], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function printWithBranding(reportTitle: string) {
  const b      = getBranding();
  const C      = buildPalette(b.primaryColor);
  const logoSrc = getLogoSrc(b);
  const dateStr = new Date().toLocaleString("pt-BR");

  const headerId = "__export-print-header__";
  const styleId  = "__export-print-style__";

  document.getElementById(headerId)?.remove();
  document.getElementById(styleId)?.remove();

  const logoHtml = logoSrc
    ? `<img src="${logoSrc}" alt="logo"
         style="height:44px;width:44px;object-fit:contain;border-radius:8px;
                border:2px solid rgba(255,255,255,0.3);" />`
    : `<div style="height:44px;width:44px;border-radius:8px;
                  background:rgba(255,255,255,0.15);border:2px solid rgba(255,255,255,0.3);
                  display:flex;align-items:center;justify-content:center;
                  font-size:16px;font-weight:800;color:#fff;">
         ${b.appName.substring(0, 2).toUpperCase()}
       </div>`;

  const header = document.createElement("div");
  header.id = headerId;
  header.innerHTML = `
    <div style="
      display:flex;align-items:center;gap:14px;
      padding:14px 20px 12px;margin-bottom:20px;
      background:linear-gradient(135deg,#${C.headerBg} 0%,#${C.subHeaderBg} 100%);
      border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,0.2);
    ">
      ${logoHtml}
      <div style="flex:1;">
        <div style="font-size:17px;font-weight:800;color:#fff;letter-spacing:-.3px;">
          ${b.appName}
        </div>
        <div style="font-size:11px;color:rgba(255,255,255,0.75);margin-top:2px;">
          ${reportTitle}
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:9px;color:rgba(255,255,255,0.55);text-transform:uppercase;letter-spacing:.5px;">
          Emitido em
        </div>
        <div style="font-size:11px;font-weight:600;color:rgba(255,255,255,0.9);margin-top:2px;">
          ${dateStr}
        </div>
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
      nav, aside, header, [data-no-print], .no-print, button,
      [role="navigation"], [role="toolbar"] { display:none !important; }
      body  { font-size:10px; margin:0; padding:12px; }
      table { width:100%; border-collapse:collapse; font-size:9.5px; }
      th    { background:#${C.colHeaderBg} !important; color:#fff !important;
              padding:5px 8px; font-weight:700; text-align:left; }
      td    { padding:4px 8px; border-bottom:1px solid #${C.border}; }
      tr:nth-child(even) td { background:#${C.rowAlt} !important; }
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
