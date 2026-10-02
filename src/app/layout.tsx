import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "TeamFit", template: "%s · TeamFit" },
  description: "เครื่องมือช่วยทำความเข้าใจพฤติกรรมการทำงานร่วมกัน (ต้นแบบ)",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1f5f8b",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
