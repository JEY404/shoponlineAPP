
import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  calculateFirstPurchaseDiscount,
  MINIMUM_ORDER_TOTAL,
  MINIMUM_ORDER_UNITS,
} from "@/lib/first-purchase-discount";

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

    const result = await prisma.$transaction(
      async (tx) => {
        const cart = await tx.cart.findUnique({
          where: { userId: user.id },
          include: {
            items: {
              include: { product: true },
            },
          },
        });

        if (!cart || cart.items.length === 0) {
          throw new CheckoutError(
            "No puedes confirmar un pedido con el carrito vacío."
          );
        }

        const totalUnits = cart.items.reduce(
          (sum, item) => sum + item.quantity,
          0
        );

        const subtotal = cart.items.reduce(
          (sum, item) =>
            sum + item.quantity * item.product.price,
          0
        );

        if (
          !Number.isSafeInteger(totalUnits) ||
          !Number.isSafeInteger(subtotal)
        ) {
          throw new CheckoutError(
            "Los valores del pedido son inválidos."
          );
        }

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

        if (totalUnits < MINIMUM_ORDER_UNITS) {
          throw new CheckoutError(
            `El pedido requiere al menos 20 unidades. Actualmente tienes ${totalUnits}.`
          );
        }

        // Conservamos el error intencional de CHECKOUT_BUG.
        const validAmount =
          user.role === "CHECKOUT_BUG"
            ? subtotal > MINIMUM_ORDER_TOTAL
            : subtotal >= MINIMUM_ORDER_TOTAL;

        if (!validAmount) {
          throw new CheckoutError(
            `El pedido no cumple el monto mínimo de $1.000.000 COP. Total actual: $${subtotal.toLocaleString("es-CO")} COP.`
          );
        }

        // El usuario de pruebas siempre es elegible.
        const isDiscountTest =
          user.role === "DISCOUNT_TEST";

        const previousConfirmedOrders = isDiscountTest
          ? 0
          : await tx.order.count({
              where: {
                userId: user.id,
                status: "CONFIRMED",
              },
            });

        const discountDetails =
          calculateFirstPurchaseDiscount(
            subtotal,
            totalUnits,
            previousConfirmedOrders > 0
          );

        const discount = discountDetails.discount;
        const finalTotal = discountDetails.finalTotal;

        if (
          !Number.isSafeInteger(finalTotal) ||
          finalTotal < 0
        ) {
          throw new CheckoutError(
            "El total final del pedido es inválido."
          );
        }

        // Cuenta especial para pruebas repetibles de RN-07.
        // No crea pedidos y no modifica el inventario.
        if (isDiscountTest) {
          await tx.cartItem.deleteMany({
            where: { cartId: cart.id },
          });

          return {
            id: `TEST-${crypto.randomUUID()}`,
            subtotal,
            discount,
            total: finalTotal,
            totalUnits,
            status: "CONFIRMED" as const,
            firstPurchaseDiscountApplied: true,
            simulated: true,
          };
        }

        // Compras normales: actualizar inventario.
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

        const newOrder = await tx.order.create({
          data: {
            userId: user.id,
            total: finalTotal,
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

        await tx.cartItem.deleteMany({
          where: { cartId: cart.id },
        });

        return {
          id: newOrder.id,
          subtotal,
          discount,
          total: finalTotal,
          totalUnits,
          status: newOrder.status,
          firstPurchaseDiscountApplied:
            discountDetails.eligibleForDiscount,
          simulated: false,
        };
      },
      {
        isolationLevel:
          Prisma.TransactionIsolationLevel.Serializable,
        timeout: 10000,
      }
    );

    return NextResponse.json({
      success: true,
      message: result.simulated
        ? "¡Compra de prueba confirmada! Se aplicó el 10 % de descuento. No se registró un pedido ni se modificó el inventario."
        : "¡Tu pedido fue confirmado correctamente!",
      order: result,
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
            "La compra entró en conflicto con otra operación. Intenta nuevamente.",
        },
        { status: 409 }
      );
    }

    console.error("ERROR EN CHECKOUT:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Ocurrió un error al procesar el pedido.",
      },
      { status: 500 }
    );
  }
}
