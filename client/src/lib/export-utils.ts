import { queryClient } from "@/lib/queryClient";
import * as XLSX from "xlsx-js-style";

// ── Color utilities ────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace(/^#/, "").padEnd(6, "0");
  return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
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
    return Math.round(255 * (ln - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)))
      .toString(16).padStart(2, "0");
  };
  return `${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

function buildPalette(primaryHex: string) {
  const safe = /^#?[0-9A-Fa-f]{6}$/.test(primaryHex) ? primaryHex : "#0ea5e9";
  const [r, g, b] = hexToRgb(safe);
  const [h, s] = rgbToHsl(r, g, b);
  const si = Math.max(s, 40);
  return {
    headerBg:    hslToHex(h, si, 22),
    subHeaderBg: hslToHex(h, si, 35),
    dateBg:      hslToHex(h, 60, 94),
    colHeaderBg: hslToHex(h, si, 48),
    rowAlt:      hslToHex(h, 40, 97),
    accent:      hslToHex(h, si, 60),
    white:       "FFFFFF",
    dark:        "1E293B",
    mid:         "475569",
    border:      "CBD5E1",
  };
}

// ── Branding ──────────────────────────────────────────────────────────────────

interface Branding {
  appName: string;
  primaryColor: string;
  logoData?: string | null;
  logoUrl?: string | null;
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

// ── xlsx-js-style XLSX builder ─────────────────────────────────────────────────

function buildXLSXBuffer(
  b: Branding,
  reportTitle: string,
  sheets: Array<{ name: string; headers: string[]; rows: (string | number)[][] }>
): ArrayBuffer {
  const C = buildPalette(b.primaryColor);
  const dateStr = new Date().toLocaleString("pt-BR");

  const wb = XLSX.utils.book_new();

  for (const { name, headers, rows } of sheets) {
    const colCount = headers.length;

    // Build AoA: header rows + col headers + data
    const aoa: (string | number)[][] = [
      [b.appName, ...Array(colCount - 1).fill("")],
      [reportTitle, ...Array(colCount - 1).fill("")],
      [`Gerado em: ${dateStr}`, ...Array(colCount - 1).fill("")],
      Array(colCount).fill(""),   // spacer
      headers,
      ...rows,
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Helper: cell address from row/col (0-based)
    const addr = (r: number, c: number) => XLSX.utils.encode_cell({ r, c });

    // Merge header/title/date rows across all columns
    const merges: XLSX.Range[] = [];
    if (colCount > 1) {
      merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } });
      merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } });
      merges.push({ s: { r: 2, c: 0 }, e: { r: 2, c: colCount - 1 } });
      merges.push({ s: { r: 3, c: 0 }, e: { r: 3, c: colCount - 1 } });
    }
    ws["!merges"] = merges;

    // Row 0 — System name
    const sysCell = ws[addr(0, 0)] || {};
    sysCell.s = {
      fill: { patternType: "solid", fgColor: { rgb: C.headerBg } },
      font: { bold: true, sz: 16, color: { rgb: "FFFFFF" }, name: "Calibri" },
      alignment: { vertical: "center", horizontal: "left", indent: 1 },
    };
    ws[addr(0, 0)] = sysCell;

    // Row 1 — Report title
    const titleCell = ws[addr(1, 0)] || {};
    titleCell.s = {
      fill: { patternType: "solid", fgColor: { rgb: C.subHeaderBg } },
      font: { sz: 12, color: { rgb: "FFFFFF" }, name: "Calibri" },
      alignment: { vertical: "center", horizontal: "left", indent: 1 },
    };
    ws[addr(1, 0)] = titleCell;

    // Row 2 — Date
    const dateCell = ws[addr(2, 0)] || {};
    dateCell.s = {
      fill: { patternType: "solid", fgColor: { rgb: C.dateBg } },
      font: { sz: 10, color: { rgb: C.mid }, name: "Calibri" },
      alignment: { vertical: "center", horizontal: "left", indent: 1 },
    };
    ws[addr(2, 0)] = dateCell;

    // Row 3 — Spacer
    const spacerCell = ws[addr(3, 0)] || { v: "" };
    spacerCell.s = { fill: { patternType: "solid", fgColor: { rgb: C.dateBg } } };
    ws[addr(3, 0)] = spacerCell;

    // Row 4 — Column headers
    headers.forEach((_, ci) => {
      const cell = ws[addr(4, ci)] || {};
      cell.s = {
        fill: { patternType: "solid", fgColor: { rgb: C.colHeaderBg } },
        font: { bold: true, sz: 10, color: { rgb: "FFFFFF" }, name: "Calibri" },
        alignment: { vertical: "center", horizontal: "center" },
        border: {
          top:    { style: "thin",  color: { rgb: C.accent } },
          bottom: { style: "thin",  color: { rgb: C.accent } },
          left:   { style: "hair",  color: { rgb: C.accent } },
          right:  { style: "hair",  color: { rgb: C.accent } },
        },
      };
      ws[addr(4, ci)] = cell;
    });

    // Data rows
    rows.forEach((row, ri) => {
      const bg = ri % 2 === 0 ? C.white : C.rowAlt;
      row.forEach((v, ci) => {
        const cell = ws[addr(ri + 5, ci)] || {};
        cell.s = {
          fill: { patternType: "solid", fgColor: { rgb: bg } },
          font: { sz: 10, color: { rgb: C.dark }, name: "Calibri" },
          alignment: { vertical: "center", horizontal: typeof v === "number" ? "center" : "left" },
          border: {
            top:    { style: "hair", color: { rgb: C.border } },
            bottom: { style: "hair", color: { rgb: C.border } },
            left:   { style: "hair", color: { rgb: C.border } },
            right:  { style: "hair", color: { rgb: C.border } },
          },
        };
        ws[addr(ri + 5, ci)] = cell;
      });
    });

    // Auto column widths
    ws["!cols"] = headers.map((h, ci) => {
      const maxData = Math.max(h.length, ...rows.map((r) => String(r[ci] ?? "").length));
      return { wch: Math.min(maxData + 4, 55) };
    });

    // Row heights
    ws["!rows"] = [
      { hpx: 40 },   // system name
      { hpx: 22 },   // report title
      { hpx: 18 },   // date
      { hpx: 6  },   // spacer
      { hpx: 22 },   // col headers
      ...rows.map(() => ({ hpx: 16 })),
    ];

    XLSX.utils.book_append_sheet(wb, ws, name.substring(0, 31));
  }

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array", cellStyles: true });
  return out as ArrayBuffer;
}

function dlBuffer(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Public API ────────────────────────────────────────────────────────────────

export function downloadBrandedXLSX(
  reportTitle: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string,
  sheetName = "Relatório"
) {
  const b      = getBranding();
  const buffer = buildXLSXBuffer(b, reportTitle, [{ name: sheetName, headers, rows }]);
  dlBuffer(buffer, filename);
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
  const b      = getBranding();
  const buffer = buildXLSXBuffer(b, reportTitle, sheets);
  dlBuffer(buffer, filename);
}

// ── CSV ───────────────────────────────────────────────────────────────────────

export function downloadBrandedCSV(
  reportTitle: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string
) {
  const { appName } = getBranding();
  const dateStr = new Date().toLocaleString("pt-BR");
  const esc = (v: string | number) => `"${String(v ?? "").replace(/"/g, '""')}"`;

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

// ── PDF print ─────────────────────────────────────────────────────────────────

export function printWithBranding(reportTitle: string) {
  const b       = getBranding();
  const C       = buildPalette(b.primaryColor);
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
      display:flex;align-items:center;gap:14px;padding:14px 20px 12px;
      margin-bottom:20px;border-radius:10px;
      background:linear-gradient(135deg,#${C.headerBg} 0%,#${C.subHeaderBg} 100%);
      box-shadow:0 2px 10px rgba(0,0,0,0.2);
    ">
      ${logoHtml}
      <div style="flex:1;">
        <div style="font-size:17px;font-weight:800;color:#fff;letter-spacing:-.3px;">${b.appName}</div>
        <div style="font-size:11px;color:rgba(255,255,255,0.75);margin-top:2px;">${reportTitle}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:9px;color:rgba(255,255,255,0.55);text-transform:uppercase;letter-spacing:.5px;">Emitido em</div>
        <div style="font-size:11px;font-weight:600;color:rgba(255,255,255,0.9);margin-top:2px;">${dateStr}</div>
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
