import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Fraunces, Inter_Tight, JetBrains_Mono } from "next/font/google";
import Nav from "@/components/Nav";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", axes: ["opsz", "SOFT"], display: "swap" });
const inter = Inter_Tight({ subsets: ["latin"], variable: "--font-inter-tight", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  title: "Aftersong",
  description: "A reminiscence agent for memory care. Three remembered favourites become a session card from the years a person remembers best.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} ${mono.variable}`}>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-paper focus:p-3">Skip to content</a>
        <Nav />
        <main id="main">{children}</main>
        <footer className="wrap py-12 mt-24 border-t border-line text-14 text-ink-2">
          <p>Aftersong is open source under the MIT licence. <a className="underline" href="https://github.com/0xkinno/aftersong">Repository</a>. Suggestions come from Qloo taste data and are not medical advice. Sources are listed on the <a className="underline" href="/evidence">evidence page</a>.</p>
        </footer>
      </body>
    </html>
  );
}
