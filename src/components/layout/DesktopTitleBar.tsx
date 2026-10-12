"use client";

import React, { useState, useEffect } from "react";

export function DesktopTitleBar() {
  const [isElectron, setIsElectron] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const w = window as any;
      if (w.penrxDesktop?.isElectron || navigator.userAgent.includes("Electron")) {
        setIsElectron(true);
      }

      const handleFsChange = () => {
        setIsFullscreen(!!document.fullscreenElement);
      };
      document.addEventListener("fullscreenchange", handleFsChange);
      return () => document.removeEventListener("fullscreenchange", handleFsChange);
    }
  }, []);

  if (!isElectron || isFullscreen) return null;

  return (
    <div
      dir="ltr"
      className="w-full h-9 bg-[#0b1329] border-b border-slate-800/80 flex items-center justify-between px-3 select-none text-xs text-slate-300 shrink-0 z-50 sticky top-0"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* Title & App Icon (Left in LTR) */}
      <div className="flex items-center gap-2">
        <img
          src="/favicon.ico"
          alt="PenRX+"
          className="w-4 h-4 object-contain rounded"
          loading="eager"
          decoding="sync"
        />
        <span className="font-bold text-[11px] text-slate-200 tracking-wide font-sans">
          منظومة إدارة الروشتات والعيادات الطبية الذكية | PenRX+
        </span>
      </div>

      {/* Reserved spacing for native Windows Controls Overlay (Right in LTR) */}
      <div
        className="w-36 h-full pointer-events-none"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      />
    </div>
  );
}
