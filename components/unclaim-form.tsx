import { ConfirmBtn } from "@/components/confirm-submit";

export function UnclaimForm({ token }: { token: string }) {
  return (
    <form method="post" action={`/api/respond/${token}/unclaim`}>
      <ConfirmBtn
        message="Let the coordinator know you can't make it?"
        variant="danger-ghost"
        block
      >
        I can&apos;t make it anymore
      </ConfirmBtn>
    </form>
  );
}
