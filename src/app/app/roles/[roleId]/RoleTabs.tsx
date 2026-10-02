"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

export function RoleTabs({ roleId }: { roleId: string }) {
  const path = usePathname();
  const tabs = [
    { href: `/app/roles/${roleId}`, label: "ภาพรวม", exact: true },
    { href: `/app/roles/${roleId}/discovery`, label: "วิเคราะห์งานกับ AI" },
    { href: `/app/roles/${roleId}/profile`, label: "โปรไฟล์เป้าหมาย" },
    { href: `/app/roles/${roleId}/invitations`, label: "ลิงก์สมัคร" },
    { href: `/app/roles/${roleId}/candidates`, label: "ผู้สมัคร" },
    { href: `/app/roles/${roleId}/compare`, label: "เปรียบเทียบ" },
  ];
  return (
    <nav aria-label="ส่วนของตำแหน่ง" className="no-print mb-6 border-b border-border overflow-x-auto">
      <ul className="flex gap-1 min-w-max">
        {tabs.map((t) => {
          const active = t.exact ? path === t.href : path.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "inline-block px-3 py-2 text-sm border-b-2 -mb-px",
                  active ? "border-primary text-primary font-medium" : "border-transparent text-muted hover:text-foreground",
                )}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
