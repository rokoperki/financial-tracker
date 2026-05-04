import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toEur } from "@/lib/exchange-rates";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const transaction = await prisma.transaction.findFirst({
    where: { id, account: { userId: session.user.id } },
    include: { account: true, category: true },
  });
  if (!transaction) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(JSON.parse(JSON.stringify(transaction)));
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.transaction.findFirst({
    where: { id, account: { userId: session.user.id } },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { categoryId, description, date, amount, currency } = await req.json();

  const newAmount = amount !== undefined ? Number(amount) : Number(existing.amount);
  const newCurrency = currency ?? existing.currency;
  const newAmountEur =
    amount !== undefined || currency !== undefined
      ? await toEur(newAmount, newCurrency)
      : Number(existing.amountEur);

  const oldAmountEur = Number(existing.amountEur);
  const balanceDelta =
    existing.type === "INCOME"
      ? newAmountEur - oldAmountEur
      : oldAmountEur - newAmountEur;

  let updated: Awaited<ReturnType<typeof prisma.transaction.update>>;

  await prisma.$transaction(async (tx) => {
    updated = await tx.transaction.update({
      where: { id },
      data: {
        categoryId: categoryId !== undefined ? (categoryId || null) : existing.categoryId,
        description: description !== undefined ? (description || null) : existing.description,
        date: date ? new Date(date) : existing.date,
        amount: newAmount,
        currency: newCurrency,
        amountEur: newAmountEur,
      },
    });
    if (existing.type !== "TRANSFER" && balanceDelta !== 0) {
      await tx.account.update({
        where: { id: existing.accountId },
        data: { balance: { increment: balanceDelta } },
      });
    }
  });

  return NextResponse.json(JSON.parse(JSON.stringify(updated!)));
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.transaction.findFirst({
    where: { id, account: { userId: session.user.id } },
    include: { account: { select: { currency: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const balanceAbs = existing.account.currency === "EUR"
    ? Number(existing.amountEur)
    : Number(existing.amount);
  const delta = existing.type === "INCOME" ? -balanceAbs : balanceAbs;

  await Promise.all([
    prisma.transaction.delete({ where: { id } }),
    existing.type !== "TRANSFER"
      ? prisma.account.update({
          where: { id: existing.accountId },
          data: { balance: { increment: delta } },
        })
      : Promise.resolve(),
  ]);

  return NextResponse.json({ ok: true });
}
