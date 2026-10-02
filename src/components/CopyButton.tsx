"use client";
import { useState } from "react";
import { Button } from "./ui";

export function CopyButton({ text, label = "คัดลอกลิงก์" }: { text: string; label?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setState("copied");
        } catch {
          setState("failed");
        }
        setTimeout(() => setState("idle"), 2000);
      }}
      aria-live="polite"
    >
      {state === "copied" ? "คัดลอกแล้ว" : state === "failed" ? "คัดลอกไม่ได้ กรุณาคัดลอกเอง" : label}
    </Button>
  );
}
