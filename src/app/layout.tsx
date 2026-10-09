import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ردّ — الرد التلقائي على التعليقات",
  description: "رد تلقائي على تعليقات فيسبوك وإنستغرام ورسائل خاصة لعملائك",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen font-sans" style={{ ["--font-tajawal" as string]: "'Tajawal'" }}>{children}</body>
    </html>
  );
}
