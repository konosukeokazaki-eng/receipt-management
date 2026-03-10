import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "経費精算・予算管理システム",
  description: "Gemini APIによる高精度OCRを活用した経費精算・予算管理システム",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
