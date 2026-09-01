"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Shared by the desktop Sidebar and the mobile nav drawer. Next's
 * router occasionally commits the new route's content a tick before a
 * shared-layout nav component re-renders with the new pathname
 * (observed on 16.3.4), which briefly highlights the old nav item.
 * Set the highlight synchronously on click and let it clear itself
 * once `pathname` actually catches up, so it can never get stuck out
 * of sync with real navigation state.
 */
export function useActiveNav() {
  const pathname = usePathname();
  const [optimisticHref, setOptimisticHref] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOptimisticHref(null);
  }, [pathname]);

  const activePath = optimisticHref ?? pathname;
  const isActive = (href: string) => activePath === href || activePath.startsWith(href + "/");

  return { activePath, isActive, setOptimisticHref };
}
