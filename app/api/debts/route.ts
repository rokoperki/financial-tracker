import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DebtDirection } from "@/lib/generated/prisma/client";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const debts = await prisma.debt.findMany({
    where: { userId: session.user.id },
    include: { payments: { orderBy: { date: "desc" } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(JSON.parse(JSON.stringify(debts)));
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, direction, totalAmount, dueDate, description } = await req.json();
  if (!name || !direction || !totalAmount) {
    return NextResponse.json({ error: "name, direction, and totalAmount are required" }, { status: 400 });
  }

  const debt = await prisma.debt.create({
    data: {
      userId: session.user.id,
      name,
      direction: direction as DebtDirection,
      totalAmount: Number(totalAmount),
      dueDate: dueDate ? new Date(dueDate) : null,
      description: description || null,
    },
    include: { payments: true },
  });

  return NextResponse.json(JSON.parse(JSON.stringify(debt)), { status: 201 });
}
