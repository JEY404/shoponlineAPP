
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { message: "No autorizado." },
        { status: 401 }
      );
    }

    const products = await prisma.product.findMany({
      where: { active: true },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        price: true,
        stock: true,
        imageUrl: true,
      },
      orderBy: { code: "asc" },
    });

    return NextResponse.json({
      success: true,
      products,
    });
  } catch (error) {
    console.error("Error al obtener productos:", error);

    return NextResponse.json(
      { message: "Error al consultar productos." },
      { status: 500 }
    );
  }
}
