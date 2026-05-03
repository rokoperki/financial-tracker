import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toEur } from "@/lib/exchange-rates";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { fromAccountId, toAccountId, amount, currency, date, description } = await req.json();

  if (!fromAccountId || !toAccountId || !amount || !date) {
    return NextResponse.json(
      { error: "fromAccountId, toAccountId, amount, and date are required" },
      { status: 400 }
    );
  }
  if (fromAccountId === toAccountId) {
    return NextResponse.json({ error: "Cannot transfer to the same account" }, { status: 400 });
  }

  const [from, to] = await Promise.all([
    prisma.account.findFirst({ where: { id: fromAccountId, userId: session.user.id, isActive: true } }),
    prisma.account.findFirst({ where: { id: toAccountId, userId: session.user.id, isActive: true } }),
  ]);
  if (!from || !to) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const txCurrency = currency ?? from.currency;
  const amountEur = await toEur(Number(amount), txCurrency);
  const txDate = new Date(date);
  const label = description || `Transfer: ${from.name} → ${to.name}`;

  await prisma.$transaction([
    prisma.transaction.create({
      data: { accountId: fromAccountId, amount, amountEur, currency: txCurrency, type: "TRANSFER", description: label, date: txDate },
    }),
    prisma.transaction.create({
      data: { accountId: toAccountId, amount, amountEur, currency: txCurrency, type: "TRANSFER", description: label, date: txDate },
    }),
    prisma.account.update({ where: { id: fromAccountId }, data: { balance: { increment: -Number(amount) } } }),
    prisma.account.update({ where: { id: toAccountId }, data: { balance: { increment: Number(amount) } } }),
  ]);

  return NextResponse.json({ ok: true }, { status: 201 });
}
