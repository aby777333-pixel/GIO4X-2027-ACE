"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { reviewKycUser } from "@/lib/kyc-actions";

export function KycReviewButtons({ userId }: { userId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function review(approve: boolean) {
    startTransition(async () => {
      await reviewKycUser(userId, approve);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => review(true)}
        disabled={pending}
        className="rounded-md bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-50"
      >
        Approve
      </button>
      <button
        type="button"
        onClick={() => review(false)}
        disabled={pending}
        className="rounded-md border border-rose-200 px-2.5 py-1 text-[11px] font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
      >
        Reject
      </button>
    </div>
  );
}
