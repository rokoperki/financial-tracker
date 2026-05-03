export type ParsedTransaction = {
  amount: number;
  currency: string;
  type: "INCOME" | "EXPENSE";
  description: string;
  date: Date;
};

export function parseRevolutCSV(csvText: string): ParsedTransaction[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const separator = lines[0].includes(";") ? ";" : ",";
  const headers = parseLine(lines[0], separator).map((h) => h.toLowerCase().trim());

  const col = (name: string) => headers.findIndex((h) => h.includes(name));
  const dateIdx = col("started date") !== -1 ? col("started date") : col("date");
  const descIdx = col("description");
  const amountIdx = col("amount");
  const currencyIdx = col("currency");
  const stateIdx = col("state");

  const results: ParsedTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i], separator);
    if (cells.length < 3) continue;

    if (stateIdx >= 0) {
      const state = cells[stateIdx]?.trim().toLowerCase();
      if (state && state !== "completed") continue;
    }

    const raw = cells[amountIdx]?.replace(/\s/g, "").replace(",", ".") ?? "";
    const amount = parseFloat(raw);
    if (isNaN(amount) || amount === 0) continue;

    const date = new Date(cells[dateIdx]?.trim() ?? "");
    if (isNaN(date.getTime())) continue;

    results.push({
      amount: Math.abs(amount),
      currency: cells[currencyIdx]?.trim() ?? "EUR",
      type: amount > 0 ? "INCOME" : "EXPENSE",
      description: cells[descIdx]?.trim() ?? "",
      date,
    });
  }

  return results;
}

function parseLine(line: string, sep: string): string[] {
  const result: string[] = [];
  let inQuotes = false;
  let current = "";

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === sep && !inQuotes) {
      result.push(current.replace(/^"|"$/g, ""));
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current.replace(/^"|"$/g, ""));
  return result;
}
