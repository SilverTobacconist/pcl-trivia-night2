"use client";

import { useEffect } from "react";

export default function ButtonClickFeedback() {
  useEffect(() => {
    const timers = new WeakMap<HTMLButtonElement, number>();

    const showFeedback = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const button = target.closest("button");
      if (!(button instanceof HTMLButtonElement) || button.disabled) return;

      const existingTimer = timers.get(button);
      if (existingTimer) window.clearTimeout(existingTimer);

      button.classList.add("button-clicked");
      const timer = window.setTimeout(() => {
        button.classList.remove("button-clicked");
        timers.delete(button);
      }, 5000);
      timers.set(button, timer);
    };

    document.addEventListener("click", showFeedback);
    return () => document.removeEventListener("click", showFeedback);
  }, []);

  return null;
}
