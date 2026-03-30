const XLSX = require("xlsx");
const path = require("path");

const file = path.join(__dirname, "enero26.xlsx");
const wb = XLSX.readFile(file);

console.log("=".repeat(80));
console.log("FILE:", path.basename(file));
console.log("SHEETS:", wb.SheetNames);
console.log("=".repeat(80));

for (const sheetName of wb.SheetNames) {
  const ws = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(ws, { defval: null });
  const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 });

  console.log("\n" + "=".repeat(80));
  console.log("SHEET:", sheetName);
  console.log(
    "ROWS:",
    data.length,
    "COLUMNS:",
    data.length > 0 ? Object.keys(data[0]).length : 0,
  );

  if (data.length === 0) {
    console.log("  (empty sheet)");
    // Print raw data in case headers are weird
    console.log("RAW DATA (first 10 rows):");
    rawData.slice(0, 10).forEach((row, i) => console.log(`  Row ${i}:`, row));
    continue;
  }

  // Column headers and types
  const cols = Object.keys(data[0]);
  console.log("\nCOLUMN HEADERS:");
  cols.forEach((col) => {
    const nonNull = data.filter((r) => r[col] != null);
    const sample = nonNull.length > 0 ? nonNull[0][col] : null;
    const type = sample === null ? "null" : typeof sample;
    const nullCount = data.filter((r) => r[col] == null).length;
    console.log(
      `  "${col}": ${type} (nulls: ${nullCount}, sample: ${JSON.stringify(sample)})`,
    );
  });

  // First 25 rows
  console.log("\nFIRST 25 ROWS:");
  data.slice(0, 25).forEach((row, i) => {
    console.log(`  Row ${i}:`, JSON.stringify(row));
  });

  // Numeric summary
  const numCols = cols.filter((col) => {
    const vals = data
      .map((r) => r[col])
      .filter((v) => v != null && typeof v === "number");
    return vals.length > data.length * 0.5;
  });

  if (numCols.length > 0) {
    console.log("\nNUMERIC SUMMARY:");
    numCols.forEach((col) => {
      const vals = data.map((r) => r[col]).filter((v) => typeof v === "number");
      const sum = vals.reduce((a, b) => a + b, 0);
      const avg = sum / vals.length;
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      console.log(
        `  "${col}": sum=${sum.toFixed(2)}, avg=${avg.toFixed(2)}, min=${min.toFixed(2)}, max=${max.toFixed(2)}, count=${vals.length}`,
      );
    });
  }

  // Unique values for categorical columns
  cols.forEach((col) => {
    const unique = [
      ...new Set(data.map((r) => r[col]).filter((v) => v != null)),
    ];
    if (unique.length > 1 && unique.length <= 25) {
      console.log(`\nUNIQUE VALUES for "${col}" (${unique.length}):`);
      console.log("  ", JSON.stringify(unique));
    }
  });

  console.log();
}
