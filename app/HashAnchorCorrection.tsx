"use client";

import { useEffect } from "react";

export function HashAnchorCorrection() {
  useEffect(() => {
    let frame = 0;
    let cancelled = false;

    const scrollToHash = () => {
      const rawHash = window.location.hash.slice(1);
      if (!rawHash) return;

      let targetId: string;
      try {
        targetId = decodeURIComponent(rawHash);
      } catch {
        return;
      }

      document.getElementById(targetId)?.scrollIntoView({ block: "start" });
    };

    const scheduleCorrection = () => {
      if (cancelled) return;
      frame = window.requestAnimationFrame(() => {
        frame = window.requestAnimationFrame(scrollToHash);
      });
    };

    void document.fonts.ready.then(scheduleCorrection);
    window.addEventListener("hashchange", scheduleCorrection);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", scheduleCorrection);
    };
  }, []);

  return null;
}
