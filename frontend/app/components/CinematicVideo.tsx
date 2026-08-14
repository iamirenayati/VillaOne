"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import styles from "./CinematicVideo.module.css";

type CinematicVideoSource = {
  src: string;
  type: string;
  media?: string;
};

type CinematicVideoProps = {
  className?: string;
  poster: string;
  sources: CinematicVideoSource[];
  label: string;
  eager?: boolean;
};

export function CinematicVideo({ className = "", poster, sources, label, eager = false }: CinematicVideoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [motionAllowed, setMotionAllowed] = useState(false);

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;

    if (motionQuery.matches || connection?.saveData) return;
    setMotionAllowed(true);

    let idleHandle = 0;
    const requestLoad = () => {
      if ("requestIdleCallback" in window) {
        idleHandle = window.requestIdleCallback(() => setShouldLoad(true), { timeout: eager ? 900 : 1800 });
      } else {
        idleHandle = window.setTimeout(() => setShouldLoad(true), eager ? 350 : 800);
      }
    };

    if (eager) {
      requestLoad();
      return () => {
        if ("cancelIdleCallback" in window) window.cancelIdleCallback(idleHandle);
        else window.clearTimeout(idleHandle);
      };
    }

    const target = containerRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      requestLoad();
    }, { rootMargin: "320px 0px" });
    observer.observe(target);

    return () => {
      observer.disconnect();
      if ("cancelIdleCallback" in window) window.cancelIdleCallback(idleHandle);
      else window.clearTimeout(idleHandle);
    };
  }, [eager]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !shouldLoad) return;
    video.load();
    void video.play().catch(() => setIsPaused(true));
  }, [shouldLoad]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isReady) return;
    if (isPaused) video.pause();
    else void video.play().catch(() => setIsPaused(true));
  }, [isPaused, isReady]);

  return (
    <div ref={containerRef} className={`${styles.frame} ${className}`.trim()}>
      {/* The native image is intentional: Vinext's optimizer cannot resolve worker assets during local/edge rendering. */}
      <img className={styles.poster} src={poster} alt="" width="1920" height="1080" fetchPriority={eager ? "high" : "auto"} loading={eager ? "eager" : "lazy"} aria-hidden="true" />
      <video
        ref={videoRef}
        className={isReady ? styles.videoReady : styles.video}
        poster={poster}
        preload="none"
        muted
        loop
        playsInline
        aria-hidden="true"
        tabIndex={-1}
        onCanPlay={() => setIsReady(true)}
        onError={() => setIsReady(false)}
      >
        {shouldLoad && sources.map((source) => (
          <source key={`${source.src}-${source.media ?? "all"}`} src={source.src} type={source.type} media={source.media} />
        ))}
      </video>
      {motionAllowed && shouldLoad && isReady && (
        <button
          type="button"
          className={styles.motionControl}
          aria-label={isPaused ? `پخش ویدئوی ${label}` : `توقف ویدئوی ${label}`}
          aria-pressed={isPaused}
          onClick={() => setIsPaused((value) => !value)}
        >
          <span aria-hidden="true">{isPaused ? "▶" : "Ⅱ"}</span>
          <span>{isPaused ? "پخش" : "توقف"}</span>
        </button>
      )}
    </div>
  );
}
