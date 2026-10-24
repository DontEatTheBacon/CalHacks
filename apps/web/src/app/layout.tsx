import type { Metadata } from "next";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { ConvexClientProvider } from "./ConvexClientProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Langkah",
  description: "Temukan dan rencanakan kuliah S1 di AS dan Inggris.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <ConvexAuthNextjsServerProvider>
      <html lang="id" className="h-full antialiased">
        <body className="min-h-full flex flex-col bg-stone-50 text-stone-900">
          <ConvexClientProvider>{children}</ConvexClientProvider>
          <footer className="mt-auto px-6 py-4 text-xs text-stone-500">
            Prototype. Fictional demo data is labeled. Weather data: Open-Meteo (CC BY 4.0). Settlement data: GeoNames (CC BY 4.0).
          </footer>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
