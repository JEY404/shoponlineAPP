
import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const username =
      typeof body.username === "string"
        ? body.username.trim()
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    if (
      !username ||
      !password ||
      username.length > 100 ||
      password.length > 200
    ) {
      return NextResponse.json(
        { message: "Credenciales inválidas." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user || !(await compare(password, user.passwordHash))) {
      return NextResponse.json(
        { message: "Usuario o contraseña incorrectos." },
        { status: 401 }
      );
    }

    await createSession(user.id);

    return NextResponse.json({
      success: true,
      message: "Inicio de sesión exitoso.",
      user: {
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Error de login:", error);

    return NextResponse.json(
      { message: "No fue posible iniciar sesión." },
      { status: 500 }
    );
  }
}
