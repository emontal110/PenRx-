"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function BranchesRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/settings");
  }, [router]);

  return (
    <div className="py-24 text-center text-slate-400 text-sm">
      جاري الانتقال إلى إعدادات وهوية المركز والفروع...
    </div>
  );
}
