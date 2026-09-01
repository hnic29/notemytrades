"use client";

import { useEffect } from "react";

/** Auto-opens the browser's print dialog once content has painted —
 * this is our "download as PDF" path: the user picks "Save as PDF" in
 * the native print dialog rather than us shipping a PDF-generation
 * library for one button. */
export function PrintTrigger() {
  useEffect(() => {
    const id = setTimeout(() => window.print(), 300);
    return () => clearTimeout(id);
  }, []);
  return null;
}
