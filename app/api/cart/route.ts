
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

function errorResponse(
  message: string,
  status: number
) {
  return NextResponse.json(
    { success: false, message },
    { status }
  );
}

function serverError(error: unknown) {
  console.error("ERROR EN API CART:", error);

  return errorResponse(
    "Error interno del carrito. Revisa la terminal de Next.js.",
    500
  );
}

// CONSULTAR CARRITO
export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return errorResponse("No autorizado.", 401);
    }

    const cart = await prisma.cart.findUnique({
      where: { userId: user.id },
      include: {
        items: {
          include: { product: true },
        },
      },
    });

    const isInventoryBug =
      user.role === "INVENTORY_BUG";

    const items = (cart?.items ?? []).map((item) => {
      const actualSubtotal =
        item.product.price * item.quantity;

      // BUG-I03:
      // Se calcula un 50% adicional incorrectamente.
      const subtotal = isInventoryBug
        ? Math.round(actualSubtotal * 1.5)
        : actualSubtotal;

      return {
        productId: item.productId,
        code: item.product.code,
        name: item.product.name,
        price: item.product.price,
        stock: item.product.stock,
        quantity: item.quantity,
        subtotal,
      };
    });

    items.sort((a, b) =>
      a.code.localeCompare(b.code)
    );

    const total = items.reduce(
      (sum, item) => sum + item.subtotal,
      0
    );

    const totalUnits = items.reduce(
      (sum, item) => sum + item.quantity,
      0
    );

    return NextResponse.json({
      success: true,
      items,
      total,
      totalUnits,
    });
  } catch (error) {
    return serverError(error);
  }
}

// AGREGAR PRODUCTOS
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return errorResponse("No autorizado.", 401);
    }

    const body = await request.json().catch(
      () => null
    );

    const productId = body?.productId;
    const quantity = body?.quantity;

    if (
      typeof productId !== "string" ||
      !Number.isSafeInteger(quantity) ||
      quantity <= 0
    ) {
      return errorResponse(
        "La cantidad debe ser un entero mayor que cero.",
        400
      );
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product || !product.active) {
      return errorResponse(
        "El producto no está disponible.",
        404
      );
    }

    const cart = await prisma.cart.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    });

    const existing = await prisma.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId,
        },
      },
    });

    const newQuantity =
      (existing?.quantity ?? 0) + quantity;

    if (!Number.isSafeInteger(newQuantity)) {
      return errorResponse(
        "Cantidad fuera del rango permitido.",
        400
      );
    }

    const isInventoryBug =
      user.role === "INVENTORY_BUG";

    // BUG-I01:
    // Permite agregar más productos del stock.
    if (
      !isInventoryBug &&
      newQuantity > product.stock
    ) {
      return errorResponse(
        `No hay existencias suficientes. Disponibles: ${product.stock}.`,
        400
      );
    }

    await prisma.cartItem.upsert({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId,
        },
      },
      update: {
        quantity: newQuantity,
      },
      create: {
        cartId: cart.id,
        productId,
        quantity,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Producto agregado correctamente.",
    });
  } catch (error) {
    return serverError(error);
  }
}

// MODIFICAR CANTIDADES
export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return errorResponse("No autorizado.", 401);
    }

    const body = await request.json().catch(
      () => null
    );

    const productId = body?.productId;
    const quantity = body?.quantity;

    if (
      typeof productId !== "string" ||
      !Number.isSafeInteger(quantity)
    ) {
      return errorResponse(
        "La cantidad debe ser un número entero.",
        400
      );
    }

    const isInventoryBug =
      user.role === "INVENTORY_BUG";

    // BUG-I02:
    // Permite cantidad cero incorrectamente.
    if (isInventoryBug) {
      if (quantity < 0) {
        return errorResponse(
          "La cantidad no puede ser negativa.",
          400
        );
      }
    } else {
      if (quantity <= 0) {
        return errorResponse(
          "La cantidad debe ser mayor que cero.",
          400
        );
      }
    }

    const cart = await prisma.cart.findUnique({
      where: { userId: user.id },
    });

    if (!cart) {
      return errorResponse(
        "Carrito no encontrado.",
        404
      );
    }

    const item = await prisma.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId,
        },
      },
      include: { product: true },
    });

    if (!item) {
      return errorResponse(
        "El producto no existe en el carrito.",
        404
      );
    }

    if (!item.product.active) {
      return errorResponse(
        "El producto ya no está disponible.",
        400
      );
    }

    if (quantity > item.product.stock) {
      return errorResponse(
        `No hay existencias suficientes. Disponibles: ${item.product.stock}.`,
        400
      );
    }

    await prisma.cartItem.update({
      where: { id: item.id },
      data: { quantity },
    });

    return NextResponse.json({
      success: true,
      message: "Cantidad modificada correctamente.",
    });
  } catch (error) {
    return serverError(error);
  }
}

// ELIMINAR PRODUCTOS
export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return errorResponse("No autorizado.", 401);
    }

    const body = await request.json().catch(
      () => null
    );

    const productId = body?.productId;

    if (typeof productId !== "string") {
      return errorResponse(
        "Producto inválido.",
        400
      );
    }

    const cart = await prisma.cart.findUnique({
      where: { userId: user.id },
    });

    if (!cart) {
      return errorResponse(
        "Carrito no encontrado.",
        404
      );
    }

    const result = await prisma.cartItem.deleteMany({
      where: {
        cartId: cart.id,
        productId,
      },
    });

    if (result.count === 0) {
      return errorResponse(
        "El producto no existe en el carrito.",
        404
      );
    }

    return NextResponse.json({
      success: true,
      message: "Producto eliminado correctamente.",
    });
  } catch (error) {
    return serverError(error);
  }
}
