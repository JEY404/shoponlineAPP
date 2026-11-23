
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type CartItem = {
  productId: string;
  code: string;
  name: string;
  price: number;
  stock: number;
  quantity: number;
  subtotal: number;
};

type CartData = {
  items: CartItem[];
  total: number;
  totalUnits: number;
  // Campos que devuelve GET /api/cart para RN-07.
  subtotal?: number;
  discount?: number;
  finalTotal?: number;
  eligibleForDiscount?: boolean;
  isFirstPurchase?: boolean;
  discountPercentage?: number;
};

type ApiResult = {
  success?: boolean;
  message?: string;
  order?: {
    id: string;
    simulated?: boolean;
    discount?: number;
    total?: number;
  };
};

const formatCOP = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);

const productIcons: Record<string, string> = {
  P001: "⌨️",
  P002: "🖱️",
  P003: "🖥️",
};

async function readResponse(response: Response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `Error HTTP ${response.status}. Revisa la terminal de Next.js.`
    );
  }
}

export default function CartPage() {
  const router = useRouter();

  const [cart, setCart] = useState<CartData | null>(null);
  const [quantities, setQuantities] = useState<
    Record<string, string>
  >({});

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  function applyCart(data: CartData) {
    setCart(data);

    const nextQuantities: Record<string, string> = {};

    for (const item of data.items) {
      nextQuantities[item.productId] = String(item.quantity);
    }

    setQuantities(nextQuantities);
  }

  const loadCart = useCallback(async () => {
    try {
      const response = await fetch("/api/cart", {
        cache: "no-store",
      });

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(
          data.message ?? "No se pudo cargar el carrito."
        );
      }

      applyCart(data as CartData);
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "Error al cargar el carrito."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Consulta inicial asíncrona
  useEffect(() => {
    const controller = new AbortController();

    async function fetchInitialCart() {
      try {
        const response = await fetch("/api/cart", {
          cache: "no-store",
          signal: controller.signal,
        });

        const data = await readResponse(response);

        if (!response.ok) {
          throw new Error(
            data.message ?? "Error al consultar el carrito."
          );
        }

        if (!controller.signal.aborted) {
          applyCart(data as CartData);
        }
      } catch (error) {
        if (controller.signal.aborted) return;

        setIsError(true);
        setMessage(
          error instanceof Error
            ? error.message
            : "Error al consultar el carrito."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void fetchInitialCart();

    return () => {
      controller.abort();
    };
  }, []);

  // Modificar cantidad o eliminar producto
  async function updateItem(
    method: "PATCH" | "DELETE",
    productId: string
  ) {
    if (busy) return;

    setBusy(true);
    setMessage("");

    try {
      const body =
        method === "PATCH"
          ? {
              productId,
              quantity: Number(quantities[productId]),
            }
          : { productId };

      const response = await fetch("/api/cart", {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = (await readResponse(response)) as ApiResult;

      if (!response.ok) {
        setIsError(true);
        setMessage(
          data.message ?? "La operación fue rechazada."
        );
        return;
      }

      setIsError(false);
      setMessage(
        data.message ?? "Carrito actualizado correctamente."
      );

      await loadCart();
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "Error de conexión."
      );
    } finally {
      setBusy(false);
    }
  }

  // Confirmar pedido
  async function confirmOrder() {
    if (busy) return;

    setBusy(true);
    setIsError(false);
    setMessage("");

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
      });

      const data = (await readResponse(response)) as ApiResult;

      if (!response.ok || !data.success) {
        setIsError(true);
        setMessage(
          data.message ?? "No se pudo confirmar el pedido."
        );
        return;
      }

      await loadCart();

      // Las operaciones de discount_user no quedan en el historial.
      // Mostrar la confirmación en el carrito para permitir repetirlas.
      if (data.order?.simulated) {
        setIsError(false);
        setMessage(
          `${data.message ?? "Compra simulada confirmada."} ` +
          `Descuento aplicado: ${formatCOP(data.order.discount ?? 0)}. ` +
          `Total de prueba: ${formatCOP(data.order.total ?? 0)}.`
        );
        return;
      }

      router.push("/orders");
      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "Error al confirmar el pedido."
      );
    } finally {
      setBusy(false);
    }
  }

  // Las condiciones mayoristas se validan con precios reales,
  // antes de aplicar el descuento. El importe mostrado del carrito
  // puede ser diferente en el perfil de prueba INVENTORY_BUG.
  const realSubtotal = (cart?.items ?? []).reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const meetsMinimumAmount = realSubtotal >= 1_000_000;
  const meetsMinimumUnits = (cart?.totalUnits ?? 0) >= 20;
  const estimatedDiscount = cart?.discount ?? 0;
  const estimatedTotal = cart?.finalTotal ?? cart?.total ?? 0;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <Link
            href="/catalog"
            className="text-2xl font-extrabold"
          >
            Shop<span className="text-blue-700">Online</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/orders"
              className="text-sm font-semibold text-blue-700 hover:underline"
            >
              Mis pedidos
            </Link>

            <Link
              href="/catalog"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100"
            >
              Seguir comprando
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
            Tu compra mayorista
          </p>

          <h1 className="mt-2 text-3xl font-extrabold">
            Carrito de compras
          </h1>

          <p className="mt-2 text-slate-500">
            Revisa los productos, modifica sus cantidades
            y confirma tu pedido.
          </p>
        </div>

        {message && (
          <div
            role="alert"
            className={`mb-6 rounded-xl border p-4 text-sm ${
              isError
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-green-200 bg-green-50 text-green-800"
            }`}
          >
            {message}
          </div>
        )}

        {loading && (
          <div className="rounded-2xl bg-white p-12 text-center shadow-sm">
            Cargando carrito...
          </div>
        )}

        {!loading && !cart && (
          <div className="rounded-2xl bg-white p-12 text-center shadow-sm">
            <p>No se pudo cargar el carrito.</p>

            <button
              type="button"
              onClick={() => {
                setMessage("");
                setLoading(true);
                void loadCart();
              }}
              className="mt-5 rounded-lg bg-blue-700 px-5 py-3 font-bold text-white"
            >
              Reintentar
            </button>
          </div>
        )}

        {!loading && cart && (
          <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
            <section className="space-y-4">
              {cart.items.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
                  <div className="mb-4 text-6xl">🛒</div>

                  <h2 className="text-xl font-bold">
                    Tu carrito está vacío
                  </h2>

                  <p className="mt-2 text-slate-500">
                    Agrega productos para realizar una compra.
                  </p>

                  <Link
                    href="/catalog"
                    className="mt-6 inline-block rounded-lg bg-blue-700 px-6 py-3 font-bold text-white"
                  >
                    Explorar productos
                  </Link>
                </div>
              ) : (
                cart.items.map((item) => (
                  <article
                    key={item.productId}
                    className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row"
                  >
                    <div className="flex h-28 w-full shrink-0 items-center justify-center rounded-xl bg-slate-100 text-6xl sm:w-28">
                      {productIcons[item.code] ?? "📦"}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-blue-700">
                        {item.code}
                      </p>

                      <h2 className="mt-1 text-xl font-bold">
                        {item.name}
                      </h2>

                      <p className="mt-2 text-sm text-slate-500">
                        Precio unitario: {formatCOP(item.price)}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        Existencias: {item.stock} unidades
                      </p>

                      <div className="mt-5 flex flex-wrap items-end gap-3">
                        <div>
                          <label
                            htmlFor={`quantity-${item.productId}`}
                            className="mb-1 block text-xs font-semibold"
                          >
                            Cantidad
                          </label>

                          <input
                            id={`quantity-${item.productId}`}
                            type="number"
                            step="1"
                            value={
                              quantities[item.productId] ?? ""
                            }
                            onChange={(event) =>
                              setQuantities((previous) => ({
                                ...previous,
                                [item.productId]:
                                  event.target.value,
                              }))
                            }
                            className="w-24 rounded-lg border border-slate-300 px-3 py-2"
                          />
                        </div>

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            updateItem("PATCH", item.productId)
                          }
                          className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                        >
                          Actualizar
                        </button>

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            updateItem("DELETE", item.productId)
                          }
                          className="rounded-lg border border-red-200 px-4 py-2 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>

                    <div className="sm:text-right">
                      <p className="text-xs text-slate-500">
                        Subtotal
                      </p>

                      <p className="text-lg font-extrabold">
                        {formatCOP(item.subtotal)}
                      </p>
                    </div>
                  </article>
                ))
              )}
            </section>

            <aside>
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-6">
                <h2 className="text-xl font-bold">
                  Resumen del pedido
                </h2>

                <div className="mt-6 space-y-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">
                      Unidades
                    </span>
                    <strong>{cart.totalUnits}</strong>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-500">
                      Productos diferentes
                    </span>
                    <strong>{cart.items.length}</strong>
                  </div>

                  <div className="border-t border-slate-200 pt-4 space-y-3">
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-600">
                        Subtotal
                      </span>
                      <strong>{formatCOP(cart.total)}</strong>
                    </div>

                    {estimatedDiscount > 0 && (
                      <div className="flex justify-between gap-3 text-green-700">
                        <span>Descuento primera compra (10 %)</span>
                        <strong>-{formatCOP(estimatedDiscount)}</strong>
                      </div>
                    )}

                    <div className="flex justify-between gap-3 border-t border-slate-200 pt-3">
                      <span className="font-bold">
                        Total a pagar
                      </span>
                      <strong className="text-xl text-blue-800">
                        {formatCOP(estimatedTotal)}
                      </strong>
                    </div>

                    {cart.isFirstPurchase && (
                      <p className="rounded-lg bg-green-50 p-3 text-xs text-green-800">
                        {cart.eligibleForDiscount
                          ? "¡Descuento disponible! Tu primera compra cumple los mínimos y tiene un 10 % de descuento."
                          : "Tienes disponible un 10 % para tu primera compra. Se aplicará cuando el pedido cumpla los mínimos de compra."}
                      </p>
                    )}

                    {!cart.isFirstPurchase && (
                      <p className="text-xs text-slate-500">
                        El descuento de primera compra ya no está disponible para esta cuenta.
                      </p>
                    )}
                    <p className="text-xs text-slate-500">
                      El descuento es estimado; la confirmación verifica nuevamente el pedido.
                    </p>
                  </div>
                </div>

                <div className="mt-6 space-y-3 rounded-xl bg-blue-50 p-4 text-sm">
                  <p className="font-bold text-blue-900">
                    Condiciones mayoristas
                  </p>

                  <p
                    className={
                      meetsMinimumAmount
                        ? "text-green-700"
                        : "text-amber-700"
                    }
                  >
                    {meetsMinimumAmount ? "✓" : "○"}{" "}
                    Mínimo {formatCOP(1000000)}
                  </p>

                  <p
                    className={
                      meetsMinimumUnits
                        ? "text-green-700"
                        : "text-amber-700"
                    }
                  >
                    {meetsMinimumUnits ? "✓" : "○"}{" "}
                    Mínimo 20 unidades
                  </p>
                </div>

                <button
                  type="button"
                  onClick={confirmOrder}
                  disabled={busy}
                  className="mt-6 w-full rounded-xl bg-blue-700 px-5 py-4 font-bold text-white hover:bg-blue-800 disabled:opacity-50"
                >
                  {busy
                    ? "Procesando pedido..."
                    : "Confirmar pedido"}
                </button>

                <p className="mt-3 text-center text-xs text-slate-500">
                  Compra simulada. No se realizará ningún cobro real.
                </p>

                <Link
                  href="/orders"
                  className="mt-5 block text-center text-sm font-semibold text-blue-700 hover:underline"
                >
                  Ver historial de pedidos
                </Link>

                <Link
                  href="/catalog"
                  className="mt-5 block rounded-lg border border-slate-300 px-4 py-3 text-center font-semibold hover:bg-slate-50"
                >
                  Seguir comprando
                </Link>
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
