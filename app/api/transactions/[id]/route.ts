import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  const { categoryId, description, date } = await req.json();
  const updated = await prisma.transaction.update({
    where: { id },
    data: {
      categoryId: categoryId ?? null,
      description: description || null,
      date: date ? new Date(date) : undefined,
    },
    include: { account: true, category: true },
  });

  return NextResponse.json(JSON.parse(JSON.stringify(updated)));
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.transaction.findFirst({
    where: { id, account: { userId: session.user.id } },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const delta =
    existing.type === "INCOME" ? -Number(existing.amount) : Number(existing.amount);

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
