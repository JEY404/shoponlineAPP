
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const formatCOP = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);

export default async function OrdersPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  const orders = await prisma.order.findMany({
    where: {
      userId: user.id,
    },
    include: {
      items: {
        include: {
          product: {
            select: {
              code: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

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

          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sm text-slate-600">
              {user.username}
            </span>

            <Link
              href="/cart"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100"
            >
              Mi carrito
            </Link>

            <Link
              href="/catalog"
              className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Catálogo
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
          Mis compras
        </p>

        <h1 className="mt-2 text-3xl font-extrabold">
          Historial de pedidos
        </h1>

        <p className="mt-2 text-slate-500">
          Consulta tus pedidos confirmados y sus detalles.
        </p>

        {orders.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <div className="text-6xl">📦</div>

            <h2 className="mt-4 text-xl font-bold">
              Todavía no tienes pedidos
            </h2>

            <p className="mt-2 text-slate-500">
              Cuando confirmes una compra válida,
              aparecerá aquí.
            </p>

            <Link
              href="/catalog"
              className="mt-6 inline-block rounded-lg bg-blue-700 px-6 py-3 font-bold text-white"
            >
              Explorar productos
            </Link>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            {orders.map((order) => (
              <article
                key={order.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-slate-50 p-5">
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">
                      Pedido
                    </p>

                    <p className="mt-1 break-all font-mono text-sm font-bold">
                      {order.id}
                    </p>

                    <p className="mt-2 text-xs text-slate-500">
                      {new Intl.DateTimeFormat("es-CO", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "America/Bogota",
                      }).format(order.createdAt)}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      order.status === "CONFIRMED"
                        ? "bg-green-100 text-green-800"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {order.status === "CONFIRMED"
                      ? "Confirmado"
                      : "Cancelado"}
                  </span>
                </div>

                <div className="p-5">
                  <div className="space-y-4">
                    {order.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4"
                      >
                        <div>
                          <p className="font-bold">
                            {item.product.name}
                          </p>

                          <p className="text-sm text-slate-500">
                            {item.product.code} ·{" "}
                            {item.quantity} unidades
                          </p>

                          <p className="text-xs text-slate-500">
                            Precio unitario:{" "}
                            {formatCOP(item.unitPrice)}
                          </p>
                        </div>

                        <p className="font-bold">
                          {formatCOP(item.subtotal)}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-slate-600">
                      Total de unidades:{" "}
                      <strong>{order.totalUnits}</strong>
                    </p>

                    <div className="text-right">
                      <p className="text-xs text-slate-500">
                        Total del pedido
                      </p>

                      <p className="text-2xl font-extrabold text-blue-800">
                        {formatCOP(order.total)}
                      </p>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
