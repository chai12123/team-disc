import type { ReactNode } from "react";
import { DemoBanner } from "@/components/DemoBanner";

export default function CandidateLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <DemoBanner />
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-6">{children}</main>
      <footer className="w-full max-w-2xl mx-auto px-4 py-6 text-xs text-muted no-print">TeamFit (ต้นแบบ) · แบบประเมินพฤติกรรมการทำงานที่รายงานด้วยตนเอง</footer>
    </>
  );
}
