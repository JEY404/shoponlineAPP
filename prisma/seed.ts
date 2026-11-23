
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { hash } from "bcryptjs";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL no está configurada.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Cargando datos de ShopOnline...");

  const products = [
    {
      code: "P001",
      name: "Teclado",
      description: "Teclado para computador.",
      price: 40000,
      stock: 30,
      active: true,
    },
    {
      code: "P002",
      name: "Mouse",
      description: "Mouse para computador.",
      price: 90000,
      stock: 10,
      active: true,
    },
    {
      code: "P003",
      name: "Monitor",
      description: "Monitor para computador.",
      price: 750000,
      stock: 1,
      active: true,
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { code: product.code },
      update: {
        name: product.name,
        description: product.description,
        price: product.price,
        active: product.active,
      },
      create: product,
    });
  }

  console.log("Productos registrados.");

  const passwordHash = await hash("ShopQA2026!", 12);

  const users = [
    {
      username: "standard_user",
      role: "STANDARD" as const,
    },
    {
      username: "checkout_bug_user",
      role: "CHECKOUT_BUG" as const,
    },
    {
      username: "inventory_bug_user",
      role: "INVENTORY_BUG" as const,
    },
  ];

  for (const user of users) {
    const savedUser = await prisma.user.upsert({
      where: { username: user.username },
      update: {
        role: user.role,
        passwordHash,
      },
      create: {
        username: user.username,
        passwordHash,
        role: user.role,
      },
    });

    await prisma.cart.upsert({
      where: { userId: savedUser.id },
      update: {},
      create: { userId: savedUser.id },
    });
  }

  console.log("Usuarios y carritos registrados.");
  console.log("ShopOnline inicializado correctamente.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
