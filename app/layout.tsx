import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "准望物联监测平台",
  description: "物联网监测平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
