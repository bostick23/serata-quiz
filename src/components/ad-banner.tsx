"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>;
  }
}

interface AdBannerProps {
  className?: string;
}

const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
const slotId = process.env.NEXT_PUBLIC_ADSENSE_SLOT_ID;

export function AdBanner({ className = "" }: AdBannerProps) {
  const adRef = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  useEffect(() => {
    if (!clientId || !slotId) return;
    if (pushed.current) return;

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // AdSense not loaded yet or blocked by ad blocker
    }
  }, []);

  // Don't render anything if AdSense is not configured
  if (!clientId || !slotId) return null;

  return (
    <div className={`w-full flex justify-center overflow-hidden ${className}`}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: "block", width: "100%", minHeight: 50 }}
        data-ad-client={clientId}
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
