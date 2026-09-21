import type { Metadata } from "next";
import { Bebas_Neue, Figtree, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const display = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
});

const ui = Figtree({
  subsets: ["latin"],
  variable: "--font-ui",
});

const hud = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-hud",
});

export const metadata: Metadata = {
  title: "THE CLAW",
  description:
    "Ask for the night you want. TypeSafe Jev weighs every prize in the pit — restaurants, pubs, films, series, dinners, wine, gifts, and things to do.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${ui.variable} ${hud.variable}`}>
      <body>{children}</body>
    </html>
  );
}
