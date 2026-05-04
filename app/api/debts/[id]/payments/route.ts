import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const debt = await prisma.debt.findFirst({ where: { id, userId: session.user.id } });
  if (!debt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { amount, date, transactionId, note } = await req.json();
  if (!amount || !date) {
    return NextResponse.json({ error: "amount and date are required" }, { status: 400 });
  }

  if (transactionId) {
    const tx = await prisma.transaction.findFirst({
      where: { id: transactionId, account: { userId: session.user.id } },
    });
    if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  const payment = await prisma.debtPayment.create({
    data: {
      debtId: id,
      amount: Number(amount),
      date: new Date(date),
      transactionId: transactionId || null,
      note: note || null,
    },
    include: { transaction: { include: { account: true } } },
  });

  return NextResponse.json(JSON.parse(JSON.stringify(payment)), { status: 201 });
}
