
import { prisma } from "../lib/prisma";

async function main() {
  const standardUser = await prisma.user.findUnique({
    where: { username: "standard_user" },
  });

  if (!standardUser) {
    throw new Error(
      "No se encontró standard_user. Primero debes cargar los usuarios de QA."
    );
  }

  await prisma.user.upsert({
    where: { username: "discount_user" },
    update: {
      role: "DISCOUNT_TEST",
      passwordHash: standardUser.passwordHash,
    },
    create: {
      username: "discount_user",
      passwordHash: standardUser.passwordHash,
      role: "DISCOUNT_TEST",
    },
  });

  console.log("Usuario discount_user creado correctamente.");
  console.log("Utiliza la misma contraseña de standard_user.");
}

main()
  .catch((error) => {
    console.error("No se pudo crear discount_user:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
