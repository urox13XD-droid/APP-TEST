import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AynilBadge from "@/components/AynilBadge";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Time Date",
  description: "Chaque minute a son anecdote : l'heure devient une année, et une histoire vraie (ou parfois de fiction) l'accompagne.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Time Date",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <AynilBadge />
      </body>
    </html>
  );
}
