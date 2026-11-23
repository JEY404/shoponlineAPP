
import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const MIN_TOTAL = 1_000_000;
const MIN_UNITS = 20;

class CheckoutError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
    this.name = "CheckoutError";
  }
}

export async function POST() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Debes iniciar sesión.",
        },
        { status: 401 }
      );
    }

    const order = await prisma.$transaction(
      async (tx) => {
        const cart = await tx.cart.findUnique({
          where: { userId: user.id },
          include: {
            items: {
              include: {
                product: true,
              },
            },
          },
        });

        // RF-07: carrito vacío
        if (!cart || cart.items.length === 0) {
          throw new CheckoutError(
            "No puedes confirmar un pedido con el carrito vacío."
          );
        }

        // Calcular totales desde la base de datos
        const totalUnits = cart.items.reduce(
          (sum, item) => sum + item.quantity,
          0
        );

        const total = cart.items.reduce(
          (sum, item) =>
            sum + item.quantity * item.product.price,
          0
        );

        if (
          !Number.isSafeInteger(total) ||
          !Number.isSafeInteger(totalUnits)
        ) {
          throw new CheckoutError(
            "Los valores del pedido son inválidos."
          );
        }

        // RF-04 y RF-05: verificar cantidades
        for (const item of cart.items) {
          if (
            !item.product.active ||
            !Number.isSafeInteger(item.quantity) ||
            item.quantity <= 0
          ) {
            throw new CheckoutError(
              `La cantidad de ${item.product.name} es inválida.`
            );
          }

          if (item.quantity > item.product.stock) {
            throw new CheckoutError(
              `No hay existencias suficientes de ${item.product.name}. Disponibles: ${item.product.stock}.`
            );
          }
        }

        // RF-09: cantidad mínima de 20 unidades
        if (totalUnits < MIN_UNITS) {
          throw new CheckoutError(
            `El pedido requiere al menos 20 unidades. Actualmente tienes ${totalUnits}.`
          );
        }

        // BUG INTENCIONAL DE CHECKOUT
        // Rechaza incorrectamente el valor exacto
        // de $1.000.000 para checkout_bug_user.
        const validAmount =
          user.role === "CHECKOUT_BUG"
            ? total > MIN_TOTAL
            : total >= MIN_TOTAL;

        if (!validAmount) {
          throw new CheckoutError(
            `El pedido no cumple el monto mínimo de $1.000.000 COP. Total actual: $${total.toLocaleString("es-CO")} COP.`
          );
        }

        // Descontar inventario solamente
        // cuando se cumplen los requisitos.
        for (const item of cart.items) {
          const updated = await tx.product.updateMany({
            where: {
              id: item.productId,
              active: true,
              stock: {
                gte: item.quantity,
              },
            },
            data: {
              stock: {
                decrement: item.quantity,
              },
            },
          });

          if (updated.count !== 1) {
            throw new CheckoutError(
              `Las existencias de ${item.product.name} cambiaron. Actualiza tu carrito.`,
              409
            );
          }
        }

        // RF-08: registrar pedido
        const newOrder = await tx.order.create({
          data: {
            userId: user.id,
            total,
            totalUnits,
            status: "CONFIRMED",
            items: {
              create: cart.items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.product.price,
                subtotal:
                  item.quantity * item.product.price,
              })),
            },
          },
        });

        // Vaciar el carrito después de crear el pedido
        await tx.cartItem.deleteMany({
          where: { cartId: cart.id },
        });

        return newOrder;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 10000,
      }
    );

    return NextResponse.json({
      success: true,
      message: "¡Tu pedido fue confirmado correctamente!",
      order: {
        id: order.id,
        total: order.total,
        totalUnits: order.totalUnits,
        status: order.status,
      },
    });
  } catch (error) {
    if (error instanceof CheckoutError) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
        },
        { status: error.status }
      );
    }

    // Conflictos de concurrencia
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2034"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "El inventario cambió durante la compra. Intenta nuevamente.",
        },
        { status: 409 }
      );
    }

    console.error("ERROR EN CHECKOUT:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          "Ocurrió un error al procesar el pedido.",
      },
      { status: 500 }
    );
  }
}
