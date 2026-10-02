"use client";
import { Button } from "./ui";

export function PrintButton() {
  return (
    <Button type="button" variant="secondary" size="sm" className="no-print" onClick={() => window.print()}>
      พิมพ์ / บันทึก PDF
    </Button>
  );
}
