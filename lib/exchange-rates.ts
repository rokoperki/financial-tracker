import { prisma } from "./prisma";

export async function getEurRate(currency: string): Promise<number> {
  if (currency === "EUR") return 1;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cached = await prisma.exchangeRate.findUnique({
    where: { fromCurrency_toCurrency_date: { fromCurrency: currency, toCurrency: "EUR", date: today } },
  });
  if (cached) return Number(cached.rate);

  const res = await fetch(`https://api.frankfurter.app/latest?from=${currency}&to=EUR`);
  if (!res.ok) throw new Error(`Rate fetch failed for ${currency}`);

  const data = await res.json();
  const rate: number = data.rates?.EUR;
  if (!rate) throw new Error(`No EUR rate for ${currency}`);

  await prisma.exchangeRate.upsert({
    where: { fromCurrency_toCurrency_date: { fromCurrency: currency, toCurrency: "EUR", date: today } },
    create: { fromCurrency: currency, toCurrency: "EUR", rate, date: today },
    update: { rate },
  });

  return rate;
}

export async function toEur(amount: number, currency: string): Promise<number> {
  const rate = await getEurRate(currency);
  return Math.round(amount * rate * 100) / 100;
}
