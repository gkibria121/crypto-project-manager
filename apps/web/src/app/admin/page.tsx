import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminDashboard } from "@/components/AdminDashboard";

export const metadata: Metadata = {
  title: "Admin Control Center | PulseOS",
  description:
    "Administrator dashboard to view and activate registered users, manage RBAC roles, and oversee all crypto projects.",
};

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <div className="h-dvh w-full bg-[#f0f2f5] dark:bg-[#0b141a]" />
      }
    >
      <AdminDashboard />
    </Suspense>
  );
}
