
import "dotenv/config";

import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "No se encontró DATABASE_URL. Verifica la conexión."
    );
  }

  // Crear una conexión independiente para este script.
  // No importamos lib/prisma.ts porque utiliza server-only.
  const adapter = new PrismaPg({
    connectionString: databaseUrl,
  });

  const prisma = new PrismaClient({ adapter });

  try {
    // Buscar la cuenta estándar existente.
    const standardUser = await prisma.user.findUnique({
      where: {
        username: "standard_user",
      },
    });

    if (!standardUser) {
      throw new Error(
        "No se encontró standard_user en la base de datos."
      );
    }

    // Crear o actualizar el usuario de pruebas.
    // Reutiliza el hash de la contraseña de standard_user.
    const discountUser = await prisma.user.upsert({
      where: {
        username: "discount_user",
      },
      update: {
        role: "DISCOUNT_TEST",
        passwordHash: standardUser.passwordHash,
      },
      create: {
        username: "discount_user",
        role: "DISCOUNT_TEST",
        passwordHash: standardUser.passwordHash,
      },
    });

    console.log("Usuario creado correctamente.");
    console.log("Username:", discountUser.username);
    console.log("Rol:", discountUser.role);
    console.log(
      "Contraseña: la misma de standard_user."
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(
    "No se pudo crear discount_user:",
    error
  );
  process.exitCode = 1;
});
