"use client";

import { useEffect, useRef } from "react";

export default function LoomLoop({ embedId }: { embedId: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      const win = iframeRef.current?.contentWindow;
      if (!win) return;
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (data?.type === "playbackEnded" || data?.type === "videoEnded") {
          win.postMessage(JSON.stringify({ type: "seek", currentTime: 0 }), "*");
          win.postMessage(JSON.stringify({ type: "play" }), "*");
        }
      } catch {
        // ignore non-JSON messages from other origins
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return (
    <iframe
      ref={iframeRef}
      src={`https://www.loom.com/embed/${embedId}?autoplay=1&muted=1&hide_owner=true&hide_share=true&hide_title=true&hideEmbedTopBar=true`}
      allowFullScreen
      allow="autoplay; fullscreen"
      className="w-full h-full"
      style={{ border: "none", display: "block" }}
    />
  );
}
