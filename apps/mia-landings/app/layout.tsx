import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@mia/core";

export const metadata: Metadata = {
  title: "MIA Landings",
  description: "Fábrica de landings de MIA Platform",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
