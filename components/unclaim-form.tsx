"use client";

import { Btn } from "@/components/ui";

export function UnclaimForm({ token }: { token: string }) {
  return (
    <form
      method="post"
      action={`/api/respond/${token}/unclaim`}
      onSubmit={(e) => {
        if (!confirm("Let the coordinator know you can't make it?")) {
          e.preventDefault();
        }
      }}
    >
      <Btn variant="danger-ghost" block>
        I can&apos;t make it anymore
      </Btn>
    </form>
  );
}
