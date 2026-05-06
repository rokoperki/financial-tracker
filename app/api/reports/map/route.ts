import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("accountId") ?? undefined;

  const where = {
    account: { userId: session.user.id },
    country: { not: null },
    NOT: { category: { name: "Transfer" } },
    ...(accountId && { accountId }),
  };

  const txs = await prisma.transaction.findMany({
    where,
    select: { country: true, city: true, amountEur: true, type: true },
  });

  const countryMap: Record<
    string,
    { expenses: number; income: number; txCount: number; cities: Set<string> }
  > = {};
  for (const tx of txs) {
    const c = tx.country!;
    if (!countryMap[c])
      countryMap[c] = { expenses: 0, income: 0, txCount: 0, cities: new Set() };
    countryMap[c].txCount++;
    if (tx.city) countryMap[c].cities.add(tx.city);
    if (tx.type === "EXPENSE") countryMap[c].expenses += Number(tx.amountEur);
    else if (tx.type === "INCOME") countryMap[c].income += Number(tx.amountEur);
  }

  const result = Object.entries(countryMap).map(([country, v]) => ({
    country,
    expenses: Math.round(v.expenses * 100) / 100,
    income: Math.round(v.income * 100) / 100,
    txCount: v.txCount,
    cities: [...v.cities],
  }));

  return NextResponse.json(result);
}
