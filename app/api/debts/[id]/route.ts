import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

async function requireOwned(id: string, userId: string) {
  return prisma.debt.findFirst({ where: { id, userId } });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!await requireOwned(id, session.user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { name, totalAmount, dueDate, description, isSettled } = await req.json();

  const debt = await prisma.debt.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(totalAmount !== undefined && { totalAmount: Number(totalAmount) }),
      ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
      ...(description !== undefined && { description: description || null }),
      ...(isSettled !== undefined && { isSettled }),
    },
    include: { payments: { orderBy: { date: "desc" } } },
  });

  return NextResponse.json(JSON.parse(JSON.stringify(debt)));
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!await requireOwned(id, session.user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.debt.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
