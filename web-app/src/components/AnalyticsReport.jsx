// Builds the "Library Visitor Report" as a PDF or an Excel file from the numbers
// on the Analytics page. Runs completely in the browser (no server work, no
// extra hosting cost).
//
// Uses these small libraries, each loaded only when its button is clicked so
// the website stays fast:
//   jspdf            → makes the PDF file
//   jspdf-autotable  → draws the PDF tables
//   exceljs          → makes the Excel file (styled tables, no letterhead)
// Install once in web-app:  npm install jspdf jspdf-autotable exceljs

// Letterhead logos live in src/assets (this file is in src/components, hence the ../).
import cvsuLogoUrl from "../assets/cvsu_logo.png";
import bagongPilipinasLogoUrl from "../assets/bagong-pilipinas-logo.png";

// Brand green as RGB (same as the website), and a light gray for zebra rows.
const GREEN = [27, 94, 32];
const DEEP = [14, 59, 31];
const ZEBRA = [244, 247, 244];

// The same colors as hex (Excel wants "RRGGBB" strings).
const XL_GREEN = "FF1B5E20";
const XL_DEEP = "FF0E3B1F";
const XL_ZEBRA = "FFF4F7F4";
const XL_LINE = "FFE1E6E1";

// Official letterhead text (from the University Librarian's letter template).
const LETTERHEAD = {
  country: "Republic of the Philippines",
  university: "CAVITE STATE UNIVERSITY",
  campus: "Don Severino de las Alas Campus",
  address: "Indang, Cavite",
  phone: "(046) 483-9250",
  website: "www.cvsu.edu.ph",
  websiteUrl: "http://www.cvsu.edu.ph/",
  office: "OFFICE OF THE UNIVERSITY LIBRARIAN",
};
// The report's name. Change it here and it changes everywhere (PDF, Excel, preview pop-up).
export const REPORT_TITLE = "Library Visitor Report";
const FILE_PREFIX = "QLess-Visitor-Report";

const LIBRARY_LINE =
  "Cavite State University - Main Campus Library";

// "October 23, 2026, 9:41 AM"
const formatDateTime = (d) =>
  d.toLocaleString("en-US", {
    month: "long", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });

// Makes a safe file name, e.g. "AY 2026-2027 • 1st Semester" → "AY-2026-2027-1st-Semester".
const toFileName = (text) =>
  text.replace(/[^A-Za-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

// The PDF's built-in font can't draw some symbols (like "•"), so swap them for plain ones.
const clean = (value) => String(value ?? "").replace(/•/g, "-").replace(/[↑↓]/g, "");

/* ========================================================================== */
/*  PDF                                                                       */
/* ========================================================================== */

// Reads one logo file into what the PDF and Excel libraries need:
// a data URL, its width/height ratio (so it is never stretched) and its format.
async function loadLogo(url) {
  const blob = await (await fetch(url)).blob();
  const src = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read the logo file."));
    reader.readAsDataURL(blob);
  });
  const ratio = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth / img.naturalHeight);
    img.onerror = () => reject(new Error("Could not load the logo image."));
    img.src = src;
  });
  return { src, ratio, format: blob.type === "image/png" ? "PNG" : "JPEG" };
}

const loadLetterheadLogos = async () => {
  const [cvsu, bagong] = await Promise.all([loadLogo(cvsuLogoUrl), loadLogo(bagongPilipinasLogoUrl)]);
  return { cvsu, bagong };
};

// Draws the CvSU letterhead (logos + university details + office name + rule).
// Returns the y position where the page content can start.
function drawLetterhead(doc, pageWidth, margin, logos) {
  const centerX = pageWidth / 2;
  const logoHeight = 24;
  const logoTop = 10;

  // Seal on the left, Bagong Pilipinas on the right.
  doc.addImage(logos.cvsu.src, logos.cvsu.format, margin, logoTop, logoHeight * logos.cvsu.ratio, logoHeight);
  const rightWidth = logoHeight * logos.bagong.ratio;
  doc.addImage(logos.bagong.src, logos.bagong.format, pageWidth - margin - rightWidth, logoTop, rightWidth, logoHeight);

  // Centered text block.
  doc.setTextColor(0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(LETTERHEAD.country, centerX, 14, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(LETTERHEAD.university, centerX, 19.5, { align: "center" });

  doc.setFontSize(9);
  doc.text(LETTERHEAD.campus, centerX, 24.5, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.text(LETTERHEAD.address, centerX, 28.5, { align: "center" });
  doc.text(LETTERHEAD.phone, centerX, 32.5, { align: "center" });

  // Website: blue, italic, underlined, clickable.
  doc.setFont("helvetica", "italic");
  doc.setTextColor(5, 99, 193);
  const siteWidth = doc.getTextWidth(LETTERHEAD.website);
  const siteX = centerX - siteWidth / 2;
  doc.textWithLink(LETTERHEAD.website, siteX, 36.5, { url: LETTERHEAD.websiteUrl });
  doc.setDrawColor(5, 99, 193);
  doc.setLineWidth(0.15);
  doc.line(siteX, 37.2, siteX + siteWidth, 37.2);

  // Office name + black rule, like the letter.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(0);
  doc.text(LETTERHEAD.office, centerX, 46, { align: "center" });

  doc.setDrawColor(0);
  doc.setLineWidth(0.6);
  doc.line(margin, 50, pageWidth - margin, 50);

  return 50;
}

/**
 * Creates the PDF report and returns it for the preview pop-up (it is NOT downloaded yet).
 * Returns { url, fileName }: url can be shown in an <iframe> and used by the
 * Download button. Call URL.revokeObjectURL(url) when the preview closes.
 *
 * report = {
 *   periodLabel, generatedBy,   // generatedBy = signed-in account name, printed as "Reported by ..." in the footer
 *   summary:  [[label, value], ...],          // the main totals
 *   sections: [{ title, note?, head: [...], rows: [[...], ...], empty }],
 * }
 */
export async function buildAnalyticsPdf(report) {
  // Load the libraries only now (first click), not when the page opens.
  const { jsPDF } = await import("jspdf");
  const tableModule = await import("jspdf-autotable");
  const autoTable = tableModule.default || tableModule.autoTable; // works with old and new versions

  const logos = await loadLetterheadLogos();
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  // Title shown in the PDF viewer's toolbar (instead of a random code).
  doc.setProperties({ title: `${REPORT_TITLE} - ${clean(report.periodLabel)}` });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const now = new Date();

  // ---------- Header (CvSU letterhead) ----------
  drawLetterhead(doc, pageWidth, margin, logos);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(20);
  doc.text(REPORT_TITLE, margin, 59);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(LIBRARY_LINE, margin, 64.5);

  doc.setFontSize(10);
  doc.setTextColor(60);
  doc.text(`Period: ${clean(report.periodLabel)}`, margin, 71);
  doc.text(`Generated: ${formatDateTime(now)}`, margin, 76.5);

  // Shared table look: green header, light zebra rows. Small font + tight
  // padding so the whole report fits on as few pages as possible.
  const tableStyle = {
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 1.6, lineColor: [225, 230, 225], lineWidth: 0.2, textColor: 40 },
    headStyles: { fillColor: GREEN, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: ZEBRA },
  };

  const gap = 6;                                   // space between the two columns
  const colWidth = (pageWidth - margin * 2 - gap) / 2;
  const pageBottom = doc.internal.pageSize.getHeight() - 18;

  // Small heading above a table, at x. Returns the y where the table should start.
  const heading = (title, note, x, top) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...DEEP);
    doc.text(clean(title), x, top);
    if (!note) return top + 2.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(120);
    doc.text(clean(note), x, top + 3.8);
    return top + 6;
  };

  // Draws one table section at column x (width w) starting at top. Returns where it ended.
  const drawSection = (section, x, w, top) => {
    const startY = heading(section.title, section.note, x, top);
    const rows = section.rows.length > 0
      ? section.rows.map((r) => r.map(clean))
      : [[{ content: section.empty || "No data for this period.", colSpan: section.head.length, styles: { halign: "center", textColor: 140, fontStyle: "italic" } }]];
    // Every column after the first holds numbers → right-aligned.
    const columnStyles = {};
    section.head.forEach((_, i) => { if (i > 0) columnStyles[i] = { halign: "right" }; });
    autoTable(doc, {
      ...tableStyle,
      startY,
      margin: { left: x, right: pageWidth - x - w },
      tableWidth: w,
      head: [section.head.map(clean)],
      body: rows,
      columnStyles,
    });
    return doc.lastAutoTable?.finalY ?? startY + 20;
  };

  // Rough height a section will need (to decide if it still fits on this page).
  const estimateHeight = (section) => 8 + (Math.max(section.rows.length, 1) + 1) * 6;

  // ---------- Summary: two statistics per row to save space ----------
  let y = 86;
  const summaryStart = heading("Summary", null, margin, y);
  const half = Math.ceil(report.summary.length / 2);
  const summaryRows = [];
  for (let i = 0; i < half; i++) {
    const left = report.summary[i];
    const right = report.summary[i + half];
    summaryRows.push([clean(left[0]), clean(left[1]), right ? clean(right[0]) : "", right ? clean(right[1]) : ""]);
  }
  autoTable(doc, {
    ...tableStyle,
    startY: summaryStart,
    margin: { left: margin, right: margin },
    head: [["Statistic", "Value", "Statistic", "Value"]],
    body: summaryRows,
    columnStyles: {
      1: { halign: "right", fontStyle: "bold", cellWidth: 26 },
      3: { halign: "right", fontStyle: "bold", cellWidth: 26 },
    },
  });
  y = (doc.lastAutoTable?.finalY ?? y + 40) + 8;

  // ---------- Breakdown tables: two side by side ----------
  for (let i = 0; i < report.sections.length; i += 2) {
    const left = report.sections[i];
    const right = report.sections[i + 1];
    const needed = Math.max(estimateHeight(left), right ? estimateHeight(right) : 0);
    if (y + needed > pageBottom) { doc.addPage(); y = 18; }

    const pageBefore = doc.getCurrentPageInfo().pageNumber;
    const leftEnd = drawSection(left, margin, colWidth, y);
    const leftPage = doc.getCurrentPageInfo().pageNumber;
    let rightEnd = 0;
    let rightPage = pageBefore;
    if (right) {
      doc.setPage(pageBefore); // right table starts beside the left one
      rightEnd = drawSection(right, margin + colWidth + gap, colWidth, y);
      rightPage = doc.getCurrentPageInfo().pageNumber;
    }
    // Continue below whichever table went further down.
    const lastPage = Math.max(leftPage, rightPage);
    doc.setPage(lastPage);
    const ends = [leftPage === lastPage ? leftEnd : 0, rightPage === lastPage ? rightEnd : 0];
    y = Math.max(...ends) + 8;
  }

  // ---------- Footer on every page ----------
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(`Reported by ${clean(report.generatedBy) || "-"}`, margin, pageHeight - 8);
    doc.text(`Page ${i} of ${pages}`, pageWidth - margin, pageHeight - 8, { align: "right" });
  }

  // Keep the finished PDF in the browser's memory as a temporary link.
  const url = URL.createObjectURL(doc.output("blob"));
  const fileName = `${FILE_PREFIX}-${toFileName(clean(report.periodLabel)) || "Analytics"}.pdf`;
  return { url, fileName };
}

/* ========================================================================== */
/*  EXCEL                                                                     */
/* ========================================================================== */

// Turns "1,234" into the number 1234 and "45.5%" into 0.455 so Excel can sort,
// sum and chart them. Anything else stays as text.
const toExcelCell = (value, numeric) => {
  const text = String(value ?? "").trim();
  if (!numeric) return { value: text };

  if (/^-?\d+(\.\d+)?%$/.test(text)) {
    const decimals = (text.match(/\.(\d+)%$/) || [])[1]?.length || 0;
    return {
      value: parseFloat(text) / 100,
      numFmt: decimals ? `0.${"0".repeat(decimals)}%` : "0%",
    };
  }
  if (/^-?\d{1,3}(,\d{3})*(\.\d+)?$|^-?\d+(\.\d+)?$/.test(text)) {
    const decimals = (text.match(/\.(\d+)$/) || [])[1]?.length || 0;
    return {
      value: Number(text.replace(/,/g, "")),
      numFmt: decimals ? `#,##0.${"0".repeat(decimals)}` : "#,##0",
    };
  }
  return { value: text };
};

// Sheet names: max 31 characters, no  \ / ? * [ ] :  and must be unique.
const makeSheetName = (title, used) => {
  const base = (String(title || "Sheet").replace(/[\\/?*[\]:]/g, " ").trim() || "Sheet").slice(0, 31);
  let name = base;
  let n = 2;
  while (used.has(name.toLowerCase())) {
    const suffix = ` (${n++})`;
    name = base.slice(0, 31 - suffix.length) + suffix;
  }
  used.add(name.toLowerCase());
  return name;
};

const thinBorder = {
  top: { style: "thin", color: { argb: XL_LINE } },
  left: { style: "thin", color: { argb: XL_LINE } },
  bottom: { style: "thin", color: { argb: XL_LINE } },
  right: { style: "thin", color: { argb: XL_LINE } },
};

// Writes a styled table (green header, zebra rows) starting at `startRow`.
// Returns { headerRow, lastRow }.
function writeExcelTable(ws, startRow, head, rows, emptyText) {
  const headerRow = ws.getRow(startRow);
  head.forEach((label, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = String(label ?? "");
    cell.font = { name: "Arial", bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: XL_GREEN } };
    cell.alignment = { vertical: "middle", horizontal: i === 0 ? "left" : "right" };
    cell.border = thinBorder;
  });
  headerRow.height = 20;

  if (rows.length === 0) {
    const r = ws.getRow(startRow + 1);
    ws.mergeCells(startRow + 1, 1, startRow + 1, head.length);
    const cell = r.getCell(1);
    cell.value = emptyText || "No data for this period.";
    cell.font = { name: "Arial", italic: true, color: { argb: "FF8C8C8C" }, size: 10 };
    cell.alignment = { horizontal: "center" };
    return { headerRow: startRow, lastRow: startRow + 1 };
  }

  rows.forEach((row, rIndex) => {
    const r = ws.getRow(startRow + 1 + rIndex);
    head.forEach((_, i) => {
      const { value, numFmt } = toExcelCell(row[i], i > 0);
      const cell = r.getCell(i + 1);
      cell.value = value;
      if (numFmt) cell.numFmt = numFmt;
      cell.font = { name: "Arial", size: 10, color: { argb: "FF282828" } };
      cell.alignment = { vertical: "middle", horizontal: i === 0 ? "left" : "right" };
      cell.border = thinBorder;
      if (rIndex % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: XL_ZEBRA } };
    });
  });
  return { headerRow: startRow, lastRow: startRow + rows.length };
}

/**
 * Creates the Excel report. Same `report` object as buildAnalyticsPdf.
 * Returns { blob, fileName }.
 *
 * Layout: a "Summary" sheet with the title and the main totals, then one
 * sheet per breakdown table (so each can be sorted, filtered or charted).
 */
export async function buildAnalyticsExcel(report) {
  const mod = await import("exceljs");
  const ExcelJS = mod.default || mod;

  const wb = new ExcelJS.Workbook();
  wb.creator = "QLess - Ladislao N. Diwa Memorial Library";
  wb.created = new Date();
  wb.title = `${REPORT_TITLE} - ${report.periodLabel}`;

  const usedNames = new Set();

  // ---------- Summary sheet ----------
  const ws = wb.addWorksheet(makeSheetName("Summary", usedNames), {
    views: [{ showGridLines: false }],
    pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  ws.columns = [{ width: 46 }, { width: 22 }];

  let row = 1;

  const textRow = (text, font) => {
    // Not merged, so long lines can run across the empty cells beside them.
    const cell = ws.getRow(row).getCell(1);
    cell.value = text;
    cell.font = { name: "Arial", ...font };
    cell.alignment = { horizontal: "left", vertical: "middle" };
    row += 1;
  };

  textRow(REPORT_TITLE, { size: 16, bold: true });
  textRow(LIBRARY_LINE, { size: 9, color: { argb: "FF5A5A5A" } });
  textRow(`Period: ${report.periodLabel}`, { size: 10, color: { argb: "FF3C3C3C" } });
  textRow(`Generated: ${formatDateTime(new Date())}`, { size: 10, color: { argb: "FF3C3C3C" } });
  row += 1;
  textRow("Summary", { size: 12, bold: true, color: { argb: XL_DEEP } });

  writeExcelTable(ws, row, ["Statistic", "Value"], report.summary, "No data for this period.");
  // Summary values sit in column B, so they are right-aligned bold numbers.
  report.summary.forEach((_, i) => {
    const cell = ws.getRow(row + 1 + i).getCell(2);
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF282828" } };
  });

  // ---------- One sheet per breakdown table ----------
  report.sections.forEach((section) => {
    const sheet = wb.addWorksheet(makeSheetName(section.title, usedNames), {
      views: [{ showGridLines: false }],
    });

    // Column widths: first column fits the labels, the others are number-sized.
    const labelLen = Math.max(
      String(section.head[0] ?? "").length,
      ...section.rows.map((r) => String(r[0] ?? "").length),
    );
    sheet.columns = section.head.map((_, i) => ({
      width: i === 0 ? Math.min(Math.max(labelLen + 4, 24), 55) : 16,
    }));

    const title = sheet.getRow(1).getCell(1);
    title.value = section.title;
    title.font = { name: "Arial", size: 14, bold: true, color: { argb: XL_DEEP } };
    sheet.getRow(1).height = 22;

    let startRow = 3;
    if (section.note) {
      const note = sheet.getRow(2).getCell(1);
      note.value = section.note;
      note.font = { name: "Arial", size: 9, italic: true, color: { argb: "FF787878" } };
      startRow = 4;
    }

    const { headerRow, lastRow } = writeExcelTable(sheet, startRow, section.head, section.rows, section.empty);
    sheet.views = [{ showGridLines: false, state: "frozen", ySplit: headerRow }];
    if (section.rows.length > 0) {
      sheet.autoFilter = {
        from: { row: headerRow, column: 1 },
        to: { row: lastRow, column: section.head.length },
      };
    }
  });

  // "Reported by <signed-in account>" at the bottom: a last line on the Summary sheet,
  // and in the print footer of every sheet (with the page number on the right).
  const reportedBy = `Reported by ${report.generatedBy || "-"}`;
  const lastSummaryRow = ws.lastRow ? ws.lastRow.number : row;
  const reportedCell = ws.getRow(lastSummaryRow + 2).getCell(1);
  reportedCell.value = reportedBy;
  reportedCell.font = { name: "Arial", size: 9, italic: true, color: { argb: "FF787878" } };
  wb.worksheets.forEach((sheet) => {
    sheet.headerFooter = { oddFooter: `&L&8${reportedBy.replace(/&/g, "&&")}&R&8Page &P of &N` };
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const fileName = `${FILE_PREFIX}-${toFileName(String(report.periodLabel ?? "")) || "Analytics"}.xlsx`;
  return { blob, fileName };
}

/** Builds the Excel report and saves it straight to the user's computer. */
export async function downloadAnalyticsExcel(report) {
  const { blob, fileName } = await buildAnalyticsExcel(report);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}