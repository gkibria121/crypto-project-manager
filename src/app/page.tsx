import { Suspense } from "react";
import { CryptoMessengerDashboard } from "@/components/CryptoMessengerDashboard";

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="h-dvh w-full bg-white dark:bg-[#111b21]" />
      }
    >
      <CryptoMessengerDashboard />
    </Suspense>
  );
}
