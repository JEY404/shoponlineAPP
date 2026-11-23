
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import AddToCart from "./AddToCart";
import Link from "next/link";
import type { UserRole } from "@/generated/prisma/client";

const formatCOP = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);



const profileNames: Record<UserRole, string> = {
  STANDARD: "Usuario estándar",
  CHECKOUT_BUG: "Usuario con bugs de checkout",
  INVENTORY_BUG: "Usuario con bugs de inventario",
  DISCOUNT_TEST: "Usuario de prueba de descuentos",
};

const productEmojis: Record<string, string> = {
  P001: "⌨️",
  P002: "🖱️",
  P003: "🖥️",
};

export default async function CatalogPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { code: "asc" },
  });

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div>
            <h1 className="text-3xl font-extrabold">
              Shop<span className="text-blue-700">Online</span>
            </h1>
            <p className="text-xs text-slate-500">
              Tecnología al por mayor
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="text-right text-sm">
              <p className="font-bold">{user.username}</p>
              <p className="text-xs text-slate-500">
                {profileNames[user.role]}
              </p>
            </div>
            <Link
              href="/cart"
              className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800"
            >
              🛒 Mi carrito
            </Link>
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100"
              >
                Cerrar sesión
              </button>
            </form>
          </div>
        </div>
      </header>

      <section className="bg-blue-800 px-6 py-14 text-white">
        <div className="mx-auto max-w-7xl">
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-blue-200">
            Catálogo mayorista
          </p>

          <h2 className="text-4xl font-extrabold">
            Tecnología para tu negocio
          </h2>

          <p className="mt-4 max-w-2xl text-blue-100">
            Explora nuestros productos y consulta sus
            precios y existencias en tiempo real.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 rounded-xl border border-blue-200 bg-blue-50 p-5">
          <h3 className="font-bold text-blue-900">
            Condiciones de compra mayorista
          </h3>

          <p className="mt-2 text-sm text-blue-800">
            Compra mínima: {formatCOP(1000000)} y al
            menos 20 unidades en total.
          </p>
        </div>

        <div className="mb-7 flex items-center justify-between">
          <h3 className="text-2xl font-bold">
            Nuestros productos
          </h3>

          <span className="text-sm text-slate-500">
            {products.length} productos
          </span>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <article
              key={product.id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="flex h-56 items-center justify-center bg-slate-100 text-8xl">
                <span role="img" aria-label={product.name}>
                  {productEmojis[product.code] ?? "📦"}
                </span>
              </div>

              <div className="p-6">
                <p className="text-xs font-bold uppercase tracking-widest text-blue-700">
                  {product.code}
                </p>

                <h4 className="mt-2 text-2xl font-bold">
                  {product.name}
                </h4>

                <p className="mt-2 min-h-12 text-sm text-slate-500">
                  {product.description}
                </p>

                <p className="mt-4 text-3xl font-extrabold text-blue-800">
                  {formatCOP(product.price)}
                </p>

                <p className="mt-2 text-sm text-slate-600">
                  Disponibles:{" "}
                  <strong>{product.stock} unidades</strong>
                </p>

                <AddToCart
                  productId={product.id}
                  stock={product.stock}
                />
              </div>
            </article>
          ))}
        </div>
      </section>

      <footer className="mt-12 border-t border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
        ShopOnline — Entorno académico de pruebas QA
      </footer>
    </main>
  );
}
