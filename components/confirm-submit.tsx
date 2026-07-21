"use client";

import { useSyncExternalStore, type ComponentProps } from "react";
import { Btn } from "@/components/ui";

const emptySubscribe = () => () => {};
const useHydrated = () =>
  useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

/**
 * Submit button for destructive form actions. Asks via `confirm()` before
 * submitting, and stays disabled until hydration — otherwise a JS-less
 * browser would POST the destructive action with no confirmation at all.
 */
export function ConfirmBtn({
  message,
  ...btn
}: { message: string } & ComponentProps<typeof Btn>) {
  const ready = useHydrated();
  return (
    <Btn
      {...btn}
      disabled={!ready}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    />
  );
}
