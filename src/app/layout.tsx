import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Metrónomo · Presets y Track",
  description: "Metrónomo online con presets de tempo/compás y un track tipo línea de tiempo.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
