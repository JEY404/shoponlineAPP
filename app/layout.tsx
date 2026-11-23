
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShopOnline | Tienda mayorista",
  description:
    "Tienda mayorista de tecnología para pruebas de calidad de software.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
