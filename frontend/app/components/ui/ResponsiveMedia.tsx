/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import type { ImgHTMLAttributes, ReactNode } from "react";
import styles from "./ResponsiveMedia.module.css";

type ResponsiveMediaProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "loading"> & {
  src?: string | null;
  alt: string;
  fallback?: ReactNode;
  aspectRatio?: string;
  loading?: "lazy" | "eager";
};

export function ResponsiveMedia({ src, alt, fallback, aspectRatio = "4 / 3", loading = "lazy", className = "", width, height, ...props }: ResponsiveMediaProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = !src || failedSrc === src;

  useEffect(() => {
    setFailedSrc(null);
  }, [src]);

  return (
    <div className={`${styles.frame} ${failed ? styles.fallback : ""} ${className}`.trim()} style={{ aspectRatio }}>
      {failed ? (fallback ?? <span className={styles.mark} aria-hidden="true">V1</span>) : <img {...props} src={src} alt={alt} width={width} height={height} loading={loading} decoding="async" onError={() => setFailedSrc(src)} />}
    </div>
  );
}
