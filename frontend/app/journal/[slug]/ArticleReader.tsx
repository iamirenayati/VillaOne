"use client";

import { useEffect, useState } from "react";

export default function ArticleReader({ title, children }: { title: string; children: React.ReactNode }) {
  const [progress, setProgress] = useState(0);
  const [shareState, setShareState] = useState<"idle" | "shared" | "copied" | "error">("idle");

  useEffect(() => {
    const onScroll = () => {
      const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(documentHeight > 0 ? Math.min(100, Math.max(0, (window.scrollY / documentHeight) * 100)) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title, url: window.location.href });
        setShareState("shared");
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setShareState("copied");
      }
      window.setTimeout(() => setShareState("idle"), 2200);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(window.location.href);
        setShareState("copied");
        window.setTimeout(() => setShareState("idle"), 2200);
      } catch {
        setShareState("error");
      }
    }
  }

  return <><div className="article-progress" style={{ width: `${progress}%` }} aria-hidden="true" /><div className="article-reader-tools"><button type="button" onClick={share} aria-label="اشتراک‌گذاری مقاله">{shareState === "shared" ? "به اشتراک گذاشته شد" : shareState === "copied" ? "لینک کپی شد" : shareState === "error" ? "اشتراک‌گذاری ناموفق بود" : "اشتراک‌گذاری مقاله"}<span>↗</span></button></div><div className="article-reader">{children}</div></>;
}
