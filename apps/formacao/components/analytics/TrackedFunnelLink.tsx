"use client";

import Link, { type LinkProps } from "next/link";
import type { ReactNode } from "react";
import { trackFunnelClient } from "@/lib/funnel-client";
import type { FunnelEventName, FunnelEventPayload } from "@/lib/funnel-log";

type Props = LinkProps & {
  className?: string;
  children: ReactNode;
  eventName: FunnelEventName;
  stage: FunnelEventPayload["stage"];
  source?: string;
  details?: Record<string, unknown>;
};

export function TrackedFunnelLink({
  className,
  children,
  eventName,
  stage,
  source,
  details,
  ...linkProps
}: Props) {
  return (
    <Link
      {...linkProps}
      className={className}
      onClick={() => {
        trackFunnelClient({
          event: eventName,
          stage,
          source,
          details: {
            ...details,
            href: typeof linkProps.href === "string" ? linkProps.href : String(linkProps.href),
          },
        });
      }}
    >
      {children}
    </Link>
  );
}
