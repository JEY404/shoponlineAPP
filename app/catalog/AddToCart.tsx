
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Props = {
  productId: string;
  stock: number;
};

export default function AddToCart({ productId, stock }: Props) {
  const router = useRouter();

  const [quantity, setQuantity] = useState("1");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function addToCart() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId,
          quantity: Number(quantity),
        }),
      });

      const text = await response.text();

      let data: { message?: string } = {};

      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          `La API respondió con error HTTP ${response.status}. Revisa la terminal de Next.js.`
        );
      }

      if (!response.ok) {
        setError(true);
        setMessage(
          data.message ?? `Error HTTP ${response.status}`
        );
        return;
      }

      setError(false);
      setMessage(
        data.message ?? "Producto agregado correctamente."
      );

      router.refresh();
    } catch (err) {
      setError(true);
      setMessage(
        err instanceof Error
          ? err.message
          : "Error desconocido del servidor."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-5 space-y-3">
      <label className="block text-sm font-semibold">
        Cantidad
      </label>

      <input
        type="number"
        step="1"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2"
      />

      <button
        type="button"
        onClick={addToCart}
        disabled={loading || stock === 0}
        className="w-full rounded-lg bg-blue-700 px-4 py-3 font-bold text-white transition hover:bg-blue-800 disabled:opacity-50"
      >
        {loading ? "Agregando..." : "Agregar al carrito"}
      </button>

      {message && (
        <p
          role="status"
          className={`rounded-lg p-3 text-sm ${
            error
              ? "bg-red-50 text-red-700"
              : "bg-green-50 text-green-700"
          }`}
        >
          {message}
        </p>
      )}

      <Link
        href="/cart"
        className="block text-center text-sm font-semibold text-blue-700 hover:underline"
      >
        Ver mi carrito
      </Link>
    </div>
  );
}
