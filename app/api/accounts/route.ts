import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AccountType } from "@/lib/generated/prisma/client";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accounts = await prisma.account.findMany({
    where: { userId: session.user.id, isActive: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(JSON.parse(JSON.stringify(accounts)));
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, type, currency, walletAddress } = await req.json();
  if (!name || !type) {
    return NextResponse.json({ error: "Name and type required" }, { status: 400 });
  }

  const account = await prisma.account.create({
    data: {
      userId: session.user.id,
      name,
      type: type as AccountType,
      currency: currency ?? "EUR",
      walletAddress: walletAddress ?? null,
    },
  });

  return NextResponse.json(JSON.parse(JSON.stringify(account)), { status: 201 });
}
