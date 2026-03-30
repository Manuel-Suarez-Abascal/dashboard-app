const XLSX = require("xlsx");
const path = require("path");

const file = path.join(__dirname, "enero26.xlsx");
const wb = XLSX.readFile(file);
const ws = wb.Sheets["Hoja1"];
const data = XLSX.utils.sheet_to_json(ws, { defval: null });

// Extract concept types
const conceptTypes = {};
data.forEach((row) => {
  const c = row.Concepto || "";
  // Try to extract type (everything before the first ALL-CAPS name)
  const match = c.match(/^(.+?)\s+[A-ZÁÉÍÓÚÑ]{2,}/);
  const type = match ? match[1].trim() : c;
  if (!conceptTypes[type]) conceptTypes[type] = { count: 0, samples: [] };
  conceptTypes[type].count++;
  if (conceptTypes[type].samples.length < 3) conceptTypes[type].samples.push(c);
});

console.log("CONCEPT TYPES:");
Object.entries(conceptTypes)
  .sort((a, b) => b[1].count - a[1].count)
  .forEach(([type, info]) => {
    console.log(`\n  "${type}" (${info.count} transactions):`);
    info.samples.forEach((s) => console.log(`    - ${s}`));
  });

// Date range
const dates = data
  .map((r) => r.Fecha)
  .filter((f) => typeof f === "number")
  .sort();
function excelToDate(serial) {
  return new Date((serial - 25569) * 86400 * 1000).toISOString().split("T")[0];
}
console.log(
  "\nDATE RANGE:",
  excelToDate(dates[0]),
  "to",
  excelToDate(dates[dates.length - 1]),
);

// unique dates
const uniqueDates = [...new Set(dates)].sort();
console.log(
  "UNIQUE DATES:",
  uniqueDates.map((d) => excelToDate(d)),
);

// Check for empty asesor
const emptyAsesor = data.filter((r) => !r.Asesor || r.Asesor.trim() === "");
console.log("\nROWS WITH EMPTY ASESOR:", emptyAsesor.length);
emptyAsesor
  .slice(0, 5)
  .forEach((r) => console.log("  ", r.Concepto, "| Valor:", r.Valor));

// Negative values
const negatives = data.filter((r) => r.Valor < 0);
console.log("\nNEGATIVE VALUE ROWS:", negatives.length);
negatives.forEach((r) =>
  console.log("  ", r.Concepto, "| Valor:", r.Valor, "| Asesor:", r.Asesor),
);

// Last rows
console.log("\nLAST 5 ROWS:");
data
  .slice(-5)
  .forEach((row, i) =>
    console.log(`  Row ${data.length - 5 + i}:`, JSON.stringify(row)),
  );
