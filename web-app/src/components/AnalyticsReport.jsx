// Builds the "Library Usage Report" PDF from the numbers on the Analytics page.
// Runs completely in the browser (no server work, no extra hosting cost).
//
// Uses two small libraries, loaded only when the button is clicked so the
// website stays fast:
//   jspdf            → makes the PDF file
//   jspdf-autotable  → draws the tables
// Install once in web-app:  npm install jspdf jspdf-autotable

// Brand green as RGB (same as the website), and a light gray for zebra rows.
const GREEN = [27, 94, 32];
const DEEP = [14, 59, 31];
const ZEBRA = [244, 247, 244];

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

/**
 * Creates the report and returns it for the preview pop-up (it is NOT downloaded yet).
 * Returns { url, fileName }: url can be shown in an <iframe> and used by the
 * Download button. Call URL.revokeObjectURL(url) when the preview closes.
 *
 * report = {
 *   periodLabel, generatedBy,
 *   summary:  [[label, value], ...],          // the main totals
 *   sections: [{ title, note?, head: [...], rows: [[...], ...], empty }],
 * }
 */
export async function buildAnalyticsPdf(report) {
  // Load the libraries only now (first click), not when the page opens.
  const { jsPDF } = await import("jspdf");
  const tableModule = await import("jspdf-autotable");
  const autoTable = tableModule.default || tableModule.autoTable; // works with old and new versions

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  // Title shown in the PDF viewer's toolbar (instead of a random code).
  doc.setProperties({ title: `Library Usage Report - ${clean(report.periodLabel)}` });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const now = new Date();

  // ---------- Header ----------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...DEEP);
  doc.text("Ladislao N. Diwa Memorial Library", margin, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(90);
  doc.text("Cavite State University - Main Campus", margin, 23.5);
  doc.text("Library Patron Access and Monitoring System (QLess)", margin, 28);

  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.8);
  doc.line(margin, 32, pageWidth - margin, 32);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(20);
  doc.text("Library Usage Report", margin, 42);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60);
  doc.text(`Period: ${clean(report.periodLabel)}`, margin, 49);
  doc.text(`Generated: ${formatDateTime(now)}${report.generatedBy ? `  by ${clean(report.generatedBy)}` : ""}`, margin, 54.5);

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
  let y = 62;
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
    doc.text("Generated by QLess · Ladislao N. Diwa Memorial Library", margin, pageHeight - 8);
    doc.text(`Page ${i} of ${pages}`, pageWidth - margin, pageHeight - 8, { align: "right" });
  }

  // Keep the finished PDF in the browser's memory as a temporary link.
  const url = URL.createObjectURL(doc.output("blob"));
  const fileName = `QLess-Report-${toFileName(clean(report.periodLabel)) || "Analytics"}.pdf`;
  return { url, fileName };
}
