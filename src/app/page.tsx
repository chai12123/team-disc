import { redirect } from "next/navigation";
import { getCurrentUser, getOrgContext } from "@/lib/auth/server";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const ctx = await getOrgContext();
  if (!ctx) redirect("/onboarding");
  redirect("/app");
}
