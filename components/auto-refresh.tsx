"use client";

import { useEffect } from "react";

export function AutoRefresh({ seconds = 60 }: { seconds?: number }) {
  useEffect(() => {
    const id = setTimeout(() => {
      window.location.reload();
    }, seconds * 1000);
    return () => clearTimeout(id);
  }, [seconds]);
  return null;
}
