const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

const file = path.join(__dirname, "enero26.xlsx");
const wb = XLSX.readFile(file);
const ws = wb.Sheets["Hoja1"];
const data = XLSX.utils.sheet_to_json(ws, { defval: null });

function excelToDate(serial) {
  if (typeof serial !== "number") return null;
  return new Date((serial - 25569) * 86400 * 1000).toISOString().split("T")[0];
}

function extractConceptType(concepto) {
  if (!concepto) return { tipo: "", cliente: "" };
  const c = concepto.trim();
  if (c.startsWith("Pago de cuota "))
    return { tipo: "Pago de cuota", cliente: c.replace("Pago de cuota ", "") };
  if (c.startsWith("Abona parcial "))
    return { tipo: "Abona parcial", cliente: c.replace("Abona parcial ", "") };
  if (c.startsWith("Nuevo prestamo-"))
    return {
      tipo: "Nuevo prestamo",
      cliente: c.replace("Nuevo prestamo-", ""),
    };
  if (c.startsWith("SUELDO "))
    return { tipo: "Sueldo", cliente: c.replace("SUELDO ", "") };
  if (c.startsWith("GASTO SOFOM")) return { tipo: "Gasto", cliente: c };
  if (c.startsWith("GASTO C..018 "))
    return { tipo: "Gasto comision", cliente: c.replace("GASTO C..018 ", "") };
  if (c.startsWith("GASTO C.C."))
    return {
      tipo: "Gasto comision",
      cliente: c.replace(/^GASTO C\.C\.?\s*/, ""),
    };
  if (c.startsWith("GASTO "))
    return { tipo: "Gasto", cliente: c.replace("GASTO ", "") };
  return { tipo: "Otro", cliente: c };
}

const transactions = [];

// Find where the MORA section starts
let moraStartIndex = -1;
for (let i = 0; i < data.length; i++) {
  if ((data[i].Asesor || "").toString().trim() === "MORA") {
    moraStartIndex = i;
    break;
  }
}

// Parse main transactions (before MORA section)
const mainEnd = moraStartIndex >= 0 ? moraStartIndex : data.length;
for (let i = 0; i < mainEnd; i++) {
  const row = data[i];
  // Skip totals row (last row) and empty rows
  if (typeof row.Valor === "string" || (!row.Concepto && !row.Asesor)) continue;

  const fecha = excelToDate(row.Fecha);
  if (!fecha) continue;

  const { tipo, cliente } = extractConceptType(row.Concepto || "");

  var asesor = (row.Asesor || "").trim();
  if (asesor === "MAROSC") asesor = "MARCOSC";

  transactions.push({
    asesor: asesor,
    fecha: fecha,
    concepto: row.Concepto || "",
    tipo_concepto: tipo,
    cliente: cliente,
    valor: typeof row.Valor === "number" ? row.Valor : 0,
    utilidad: typeof row.Utilidad === "number" ? row.Utilidad : 0,
    comision_prestamo:
      typeof row["Comision prestamo"] === "number"
        ? row["Comision prestamo"]
        : 0,
    comision_cobro:
      typeof row["Comision cobro"] === "number" ? row["Comision cobro"] : 0,
    total_cc: typeof row["Total CC"] === "number" ? row["Total CC"] : 0,
    medio_pago: (row["Medio pago"] || "").trim(),
    mora: "No",
  });
}

// Parse MORA section (after MORA header row)
if (moraStartIndex >= 0) {
  // The row after MORA header contains column names: Ruta, Fecha_pago, etc.
  // The actual data starts 2 rows after MORA
  for (let i = moraStartIndex + 2; i < data.length; i++) {
    const row = data[i];
    // Skip totals/empty rows
    if (!row.Asesor && !row.Concepto) continue;
    // If Fecha is a string (totals row), skip
    if (typeof row.Fecha === "string") continue;

    const fecha = excelToDate(row.Fecha);
    if (!fecha) continue;

    const cliente = (row.Concepto || "").toString().trim();
    if (!cliente) continue;

    var asesorMora = (row.Asesor || "").trim();

    transactions.push({
      asesor: asesorMora,
      fecha: fecha,
      concepto: "Mora " + cliente,
      tipo_concepto: "Mora",
      cliente: cliente,
      valor: typeof row.Valor === "number" ? row.Valor : 0,
      utilidad: typeof row.Utilidad === "number" ? row.Utilidad : 0,
      comision_prestamo:
        typeof row["Comision prestamo"] === "number"
          ? row["Comision prestamo"]
          : 0,
      comision_cobro: 0,
      total_cc: 0,
      medio_pago: "",
      mora: "Sí",
    });
  }
}

const outDir = path.join(__dirname, "data");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
fs.writeFileSync(
  path.join(outDir, "transactions.json"),
  JSON.stringify(transactions, null, 2),
);

console.log(
  `Exported ${transactions.length} transactions to data/transactions.json`,
);
console.log("Concept types:", [
  ...new Set(transactions.map((t) => t.tipo_concepto)),
]);
console.log(
  "Date range:",
  transactions[0].fecha,
  "-",
  transactions[transactions.length - 1].fecha,
);
