import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { Providers } from "@/src/components/Providers";
import Link from "next/link";
import SearchBar from "@/src/components/SearchBar";
import HeaderActions from "@/src/components/HeaderActions";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "UniMe Catalog",
  description: "University Video Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 text-gray-900 antialiased`}>
        <Providers>
          <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
              <Link href="/" className="shrink-0 flex items-center gap-2.5 hover:opacity-80 transition-opacity">
                <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center shadow-sm">
                  <span className="text-white font-bold text-sm">UM</span>
                </div>
                <span className="text-base font-bold text-slate-900 tracking-tight hidden sm:block">
                  UniMe Catalog
                </span>
              </Link>

              <div className="flex-1 max-w-xl flex justify-center">
                <Suspense
                  fallback={
                    <div className="w-full max-w-md h-9 rounded-full bg-gray-100 border border-gray-200" />
                  }
                >
                  <SearchBar />
                </Suspense>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                <HeaderActions />
              </div>
            </div>
          </header>

          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
