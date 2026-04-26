"use client";

import { useEffect } from "react";
import { trackFunnelClient } from "@/lib/funnel-client";
import type { FunnelEventPayload } from "@/lib/funnel-log";

type Props = Omit<FunnelEventPayload, "path">;

export function FunnelViewTracker(props: Props) {
  useEffect(() => {
    trackFunnelClient(props);
  }, [props.event, props.stage, props.source, props.tenant_id, props.tenant_slug, props.user_id]);

  return null;
}
