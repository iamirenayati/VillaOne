"use client";

import Link from "next/link";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { canUseWebGL, scheduleSceneStart } from "./runtime.mjs";
import { selectQualityProfile, VIEWPOINTS } from "./scene/config.mjs";
import { DioramaErrorBoundary } from "./DioramaErrorBoundary";
import { DioramaPoster } from "./DioramaPoster";
import styles from "./Diorama.module.css";

type RuntimeState = "waiting" | "loading" | "ready" | "unsupported" | "lost" | "error";
type ViewpointId = "arrival" | "architecture" | "canopy" | "water";
type ScenePreferences = { width: number; coarsePointer: boolean; reducedMotion: boolean };

const createCanvasModule = () => lazy(() => import("./scene/DioramaCanvas").then((module) => ({ default: module.DioramaCanvas })));
const DEFAULT_PREFERENCES: ScenePreferences = { width: 1280, coarsePointer: false, reducedMotion: false };

export function DioramaExperience() {
  const [CanvasModule, setCanvasModule] = useState(createCanvasModule);
  const [runtimeState, setRuntimeState] = useState<RuntimeState>("waiting");
  const [resetKey, setResetKey] = useState(0);
  const [cameraRequest, setCameraRequest] = useState({ id: "arrival", sequence: 0 });
  const [manualCamera, setManualCamera] = useState(false);
  const [preferences, setPreferences] = useState<ScenePreferences>(DEFAULT_PREFERENCES);
  const quality = useMemo(() => selectQualityProfile(preferences), [preferences]);

  useEffect(() => scheduleSceneStart(() => {
    setRuntimeState(canUseWebGL() ? "loading" : "unsupported");
  }), []);

  useEffect(() => {
    const coarsePointer = window.matchMedia("(pointer: coarse)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animationFrame = 0;

    const updatePreferences = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        setPreferences({
          width: window.innerWidth,
          coarsePointer: coarsePointer.matches,
          reducedMotion: reducedMotion.matches,
        });
      });
    };

    updatePreferences();
    window.addEventListener("resize", updatePreferences, { passive: true });
    coarsePointer.addEventListener("change", updatePreferences);
    reducedMotion.addEventListener("change", updatePreferences);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", updatePreferences);
      coarsePointer.removeEventListener("change", updatePreferences);
      reducedMotion.removeEventListener("change", updatePreferences);
    };
  }, []);

  function retryScene() {
    if (!canUseWebGL()) {
      setRuntimeState("unsupported");
      return;
    }
    setResetKey((value) => value + 1);
    setCanvasModule(() => createCanvasModule());
    setRuntimeState("loading");
  }

  function requestView(id: ViewpointId) {
    setManualCamera(false);
    setCameraRequest((current) => ({ id, sequence: current.sequence + 1 }));
  }

  const isPreparing = runtimeState === "waiting" || runtimeState === "loading";
  const hasFailure = runtimeState === "unsupported" || runtimeState === "lost" || runtimeState === "error";

  return (
    <section className={styles.experience} aria-labelledby="diorama-title">
      <div className={styles.canvasSlot}>
        <div className={`${styles.posterLayer} ${runtimeState === "ready" ? styles.posterHidden : ""}`}><DioramaPoster /></div>
        {(runtimeState === "loading" || runtimeState === "ready") && (
          <div className={`${styles.canvasLayer} ${runtimeState === "ready" ? styles.canvasReady : ""}`}>
            <DioramaErrorBoundary resetKey={resetKey} onError={() => setRuntimeState("error")}>
              <Suspense fallback={null}>
                <CanvasModule
                  key={resetKey}
                  quality={quality}
                  reducedMotion={preferences.reducedMotion}
                  request={cameraRequest}
                  onContextLost={() => setRuntimeState("lost")}
                  onInteract={() => setManualCamera(true)}
                  onReady={() => setRuntimeState("ready")}
                />
              </Suspense>
            </DioramaErrorBoundary>
          </div>
        )}
      </div>
      <div className={styles.sceneControls} data-ready={runtimeState === "ready"}>
        <nav className={styles.viewpoints} aria-label="زاویه‌های دید">
          {VIEWPOINTS.map((viewpoint) => (
            <button
              key={viewpoint.id}
              type="button"
              disabled={runtimeState !== "ready"}
              aria-pressed={!manualCamera && cameraRequest.id === viewpoint.id}
              onClick={() => requestView(viewpoint.id)}
            >
              <span>{viewpoint.label}</span>
              <small>{viewpoint.description}</small>
            </button>
          ))}
        </nav>
        <button
          className={styles.resetView}
          type="button"
          disabled={runtimeState !== "ready"}
          onClick={() => requestView("arrival")}
        >
          <span aria-hidden="true">↺</span>
          بازگشت به نمای اصلی
        </button>
        <p className={styles.interactionHint}>با ماوس، لمس یا دکمه‌های زاویه، مجسمه را کشف کنید.</p>
      </div>
      <div className={styles.editorial}>
        <p className={styles.conceptLabel}><span /> تجربه مفهومی</p>
        <h1 id="diorama-title">جنگل هیرکانی،<br />بازآفرینی‌شده</h1>
        <p className={styles.lead}>یک ویلای خیالی؛ روایتی از معماری آرام در میان جنگل شمال.</p>
        {isPreparing && <p className={styles.status} role="status" aria-live="polite" aria-busy="true"><i /> در حال آماده‌سازی جنگل…</p>}
        {runtimeState === "unsupported" && <p className={styles.failure} role="status">نمای تعاملی سه‌بعدی در این مرورگر در دسترس نیست؛ تصویر مفهومی همچنان قابل مشاهده است.</p>}
        {runtimeState === "lost" && <p className={styles.failure} role="alert">ارتباط نمای سه‌بعدی با پردازنده گرافیکی قطع شد. تصویر مفهومی امن باقی مانده و می‌توانید صحنه را دوباره راه‌اندازی کنید.</p>}
        {runtimeState === "error" && <p className={styles.failure} role="alert">آماده‌سازی نمای سه‌بعدی کامل نشد. می‌توانید دوباره تلاش کنید یا ویلاهای واقعی را ببینید.</p>}
        <div className={styles.fallbackActions}>
          {hasFailure && runtimeState !== "unsupported" && <button type="button" onClick={retryScene}>تلاش دوباره</button>}
          <Link className={styles.fallbackLink} href="/villas">مشاهده ویلاهای واقعی <span aria-hidden="true">←</span></Link>
        </div>
      </div>
      <p className={styles.locationNote}>مازندران · جنگل هیرکانی</p>
    </section>
  );
}
