import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3001";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    title: "ویلاوان | اقامتگاه‌های لوکس مازندران",
    description: "مجموعه‌ای دست‌چین از ویلاهای لوکس مازندران، با رزرو مطمئن و کانسیرج شخصی.",
    openGraph: {
      title: "VillaOne | ویلاوان",
      description: "ویلاهای خاص؛ سفرهای ماندگار",
      locale: "fa_IR",
      type: "website",
      images: [{ url: `${origin}/og.png`, width: 1736, height: 909, alt: "VillaOne — ویلاهای خاص؛ سفرهای ماندگار" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "VillaOne | ویلاوان",
      description: "ویلاهای خاص؛ سفرهای ماندگار",
      images: [`${origin}/og.png`],
    },
    icons: {
      icon: "/brand/villaone-mark.svg",
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
