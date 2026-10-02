import Link from "next/link";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger";
const variantClass: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:opacity-90 border border-primary",
  secondary: "bg-surface text-foreground border border-border hover:bg-primary-soft",
  ghost: "bg-transparent text-primary hover:bg-primary-soft border border-transparent",
  danger: "bg-surface text-danger border border-danger hover:bg-red-50",
};

export function Button({ variant = "primary", className, size = "md", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "sm" ? "px-3 py-1.5 text-sm" : size === "lg" ? "px-5 py-3 text-base" : "px-4 py-2 text-sm";
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-[var(--radius)] font-medium transition disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]",
        sizeClass,
        variantClass[variant],
        className,
      )}
      {...props}
    />
  );
}

export function LinkButton({ href, children, variant = "secondary", className }: { href: string; children: ReactNode; variant?: Variant; className?: string }) {
  return (
    <Link
      href={href}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-[var(--radius)] px-4 py-2 text-sm font-medium transition min-h-[44px]",
        variantClass[variant],
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function Card({ children, className, as: Tag = "section" }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" }) {
  return <Tag className={cx("bg-surface border border-border rounded-[var(--radius)] p-4 sm:p-6", className)}>{children}</Tag>;
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "info" }) {
  const toneClass = {
    neutral: "bg-gray-100 text-gray-700 border-gray-200",
    success: "bg-green-50 text-green-800 border-green-200",
    warning: "bg-amber-50 text-amber-800 border-amber-200",
    danger: "bg-red-50 text-red-800 border-red-200",
    info: "bg-primary-soft text-primary border-blue-200",
  }[tone];
  return <span className={cx("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", toneClass)}>{children}</span>;
}

export function Alert({ children, tone = "info", title, className }: { children: ReactNode; tone?: "info" | "warning" | "danger" | "success"; title?: string; className?: string }) {
  const toneClass = {
    info: "bg-primary-soft border-blue-200 text-foreground",
    warning: "bg-amber-50 border-amber-200 text-amber-900",
    danger: "bg-red-50 border-red-200 text-red-900",
    success: "bg-green-50 border-green-200 text-green-900",
  }[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cx("rounded-[var(--radius)] border p-3 sm:p-4 text-sm", toneClass, className)}>
      {title && <p className="font-semibold mb-1">{title}</p>}
      {children}
    </div>
  );
}

export function Label({ children, htmlFor, hint }: { children: ReactNode; htmlFor?: string; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium mb-1">
      {children}
      {hint && <span className="block text-xs font-normal text-muted">{hint}</span>}
    </label>
  );
}

const fieldClass = "w-full rounded-[var(--radius)] border border-border bg-surface px-3 py-2 text-base text-foreground placeholder:text-muted/70 focus:border-ring min-h-[44px]";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(fieldClass, props.className)} />;
}
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(fieldClass, "min-h-[88px]", props.className)} />;
}
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(fieldClass, props.className)} />;
}

export function Spinner({ label = "กำลังโหลด" }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm text-muted">
      <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary" />
      {label}
    </span>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="text-center py-10 px-4 border border-dashed border-border rounded-[var(--radius)] bg-surface">
      <p className="font-medium">{title}</p>
      {description && <p className="text-sm text-muted mt-1 max-w-md mx-auto">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
      <div>
        {eyebrow && <div className="text-xs text-muted mb-1">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <div className="text-sm text-muted mt-1 max-w-2xl">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function Disclaimer({ children }: { children?: ReactNode }) {
  return (
    <p className="text-xs text-muted leading-relaxed">
      {children ??
        "TeamFit เป็นเครื่องมือช่วยสนทนาและทำความเข้าใจการทำงานร่วมกัน ไม่ตัดสินรับหรือปฏิเสธผู้สมัคร คะแนนเป็นพฤติกรรมที่รายงานด้วยตนเองตามสเกลของต้นแบบ ยังไม่ผ่าน psychometric validation และไม่ใช่โอกาสทำงานสำเร็จ"}
    </p>
  );
}
