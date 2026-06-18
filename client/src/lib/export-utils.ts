import { queryClient } from "@/lib/queryClient";

// ── Color utilities ───────────────────────────────────────────────────────────

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

/** Resolve logo to { base64, ext } — handles data URIs and remote URLs */
async function resolveLogo(b: Branding): Promise<{ base64: string; ext: string } | null> {
  const src = b.logoData || b.logoUrl;
  if (!src) return null;

  // Data URI  →  extract base64 directly
  if (src.startsWith("data:")) {
    const m = src.match(/^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,(.+)$/i);
    if (!m) return null;
    const ext = m[1].toLowerCase().replace("svg+xml", "png").replace("jpg", "jpeg");
    return { base64: m[2], ext };
  }

  // Remote URL  →  fetch → convert to base64
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "image/png";
    const ext = ct.includes("jpeg") || ct.includes("jpg") ? "jpeg" : "png";
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = "";
    bytes.forEach((byte) => (bin += String.fromCharCode(byte)));
    return { base64: btoa(bin), ext };
  } catch {
    return null;
  }
}

// ── ExcelJS XLSX builder ──────────────────────────────────────────────────────

function dlBuffer(buffer: ArrayBuffer | Buffer, filename: string) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

async function buildWorkbook(
  b: Branding,
  reportTitle: string,
  sheets: Array<{ name: string; headers: string[]; rows: (string | number)[][] }>
): Promise<ArrayBuffer> {
  // Alias in vite.config.ts maps "exceljs" → exceljs.min.js (browser-compatible bundle)
  const ExcelJS = (await import("exceljs")).default;
  const wb  = new ExcelJS.Workbook();
  wb.creator  = b.appName;
  wb.created  = new Date();

  const C       = buildPalette(b.primaryColor);
  const dateStr = new Date().toLocaleString("pt-BR");
  const argb    = (hex: string) => `FF${hex.toUpperCase()}`;

  // Resolve logo once for all sheets
  const logo = await resolveLogo(b);

  for (const { name, headers, rows } of sheets) {
    const ws       = wb.addWorksheet(name.substring(0, 31));
    const colCount = headers.length;

    // ── Auto column widths ──
    ws.columns = headers.map((h, ci) => {
      const maxData = Math.max(h.length, ...rows.map((r) => String(r[ci] ?? "").length));
      return { width: Math.min(maxData + 4, 55) };
    });

    // ── Add logo image ──
    let logoColOffset = 1; // data starts at col index 1 (A) by default
    if (logo) {
      try {
        const imgId = wb.addImage({
          base64:    logo.base64,
          extension: logo.ext as any,
        });
        // Occupy column A, rows 1-3 (tl inclusive, br exclusive in ExcelJS nativeSize=false)
        ws.addImage(imgId, {
          tl: { col: 0.08, row: 0.1 } as any,
          br: { col: 1,    row: 3   } as any,
          editAs: "oneCell",
        });
        logoColOffset = 1; // logo is in col 0 (A); text starts from col 1 (B)

        // Fill col A rows 1-4 with matching bg so there's no white gap
        const rowBgs = [C.headerBg, C.subHeaderBg, C.subHeaderBg, C.dateBg];
        rowBgs.forEach((bg, ri) => {
          const cell = ws.getCell(ri + 1, 1);
          cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: argb(bg) } };
        });
      } catch {
        logoColOffset = 0; // logo failed — use full width
      }
    } else {
      logoColOffset = 0;
    }

    const textStartCol = logoColOffset + 1; // 1-based ExcelJS column index

    // ── Row 1 — System name ──
    ws.getRow(1).height = 46;
    if (textStartCol <= colCount) {
      ws.mergeCells(1, textStartCol, 1, colCount);
    }
    const sysCell = ws.getCell(1, textStartCol);
    sysCell.value = b.appName;
    sysCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: argb(C.headerBg) } };
    sysCell.font  = { bold: true, size: 16, color: { argb: "FFFFFFFF" }, name: "Calibri" };
    sysCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

    // ── Row 2 — Report title ──
    ws.getRow(2).height = 22;
    if (textStartCol <= colCount) {
      ws.mergeCells(2, textStartCol, 2, colCount);
    }
    const titleCell = ws.getCell(2, textStartCol);
    titleCell.value = reportTitle;
    titleCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: argb(C.subHeaderBg) } };
    titleCell.font  = { size: 11, color: { argb: "FFFFFFFF" }, name: "Calibri" };
    titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

    // ── Row 3 — Date ──
    ws.getRow(3).height = 18;
    if (textStartCol <= colCount) {
      ws.mergeCells(3, textStartCol, 3, colCount);
    }
    const dateCell = ws.getCell(3, textStartCol);
    dateCell.value = `Gerado em: ${dateStr}`;
    dateCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: argb(C.dateBg) } };
    dateCell.font  = { size: 10, color: { argb: argb(C.mid) }, name: "Calibri" };
    dateCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

    // ── Row 4 — Spacer ──
    ws.getRow(4).height = 6;
    ws.mergeCells(4, 1, 4, colCount);
    ws.getCell(4, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(C.dateBg) } };

    // ── Row 5 — Column headers ──
    ws.getRow(5).height = 22;
    headers.forEach((h, ci) => {
      const cell = ws.getCell(5, ci + 1);
      cell.value = h;
      cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: argb(C.colHeaderBg) } };
      cell.font  = { bold: true, size: 10, color: { argb: "FFFFFFFF" }, name: "Calibri" };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = {
        top:    { style: "thin", color: { argb: argb(C.accent) } },
        bottom: { style: "thin", color: { argb: argb(C.accent) } },
        left:   { style: "hair", color: { argb: argb(C.accent) } },
        right:  { style: "hair", color: { argb: argb(C.accent) } },
      };
    });

    // ── Data rows ──
    rows.forEach((row, ri) => {
      const rowNum = ri + 6;
      const bg     = ri % 2 === 0 ? C.white : C.rowAlt;
      ws.getRow(rowNum).height = 16;
      row.forEach((v, ci) => {
        const cell = ws.getCell(rowNum, ci + 1);
        cell.value = v;
        cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: argb(bg) } };
        cell.font  = { size: 10, color: { argb: argb(C.dark) }, name: "Calibri" };
        cell.alignment = {
          vertical:   "middle",
          horizontal: typeof v === "number" ? "center" : "left",
        };
        cell.border = {
          top:    { style: "hair", color: { argb: argb(C.border) } },
          bottom: { style: "hair", color: { argb: argb(C.border) } },
          left:   { style: "hair", color: { argb: argb(C.border) } },
          right:  { style: "hair", color: { argb: argb(C.border) } },
        };
      });
    });
  }

  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function downloadBrandedXLSX(
  reportTitle: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string,
  sheetName = "Relatório"
) {
  const b      = getBranding();
  const buffer = await buildWorkbook(b, reportTitle, [{ name: sheetName, headers, rows }]);
  dlBuffer(buffer, filename);
}

export interface XLSXSheet {
  name: string;
  headers: string[];
  rows: (string | number)[][];
}

export async function downloadBrandedXLSXMulti(
  reportTitle: string,
  sheets: XLSXSheet[],
  filename: string
) {
  const b      = getBranding();
  const buffer = await buildWorkbook(b, reportTitle, sheets);
  dlBuffer(buffer, filename);
}

// ── CSV (no async needed) ─────────────────────────────────────────────────────

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
