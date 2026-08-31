"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useRef } from "react";
import { ACESFilmicToneMapping, SRGBColorSpace } from "three";
import { attachWebGLContextGuard } from "../runtime.mjs";
import { CameraRig, type CameraRequest } from "./CameraRig";
import { HyrcanianWorld } from "./HyrcanianWorld";
import type { selectQualityProfile } from "./config.mjs";

type QualityProfile = ReturnType<typeof selectQualityProfile>;

export type DioramaCanvasProps = {
  onReady: () => void;
  onInteract: () => void;
  onContextLost: () => void;
  quality: QualityProfile;
  reducedMotion: boolean;
  request: CameraRequest;
};

function FirstFrame({ onReady }: { onReady: () => void }) {
  const reported = useRef(false);
  useFrame(() => {
    if (reported.current) return;
    reported.current = true;
    onReady();
  });
  return null;
}

function ContextGuard({ onContextLost }: { onContextLost: () => void }) {
  const { gl } = useThree();
  useEffect(() => attachWebGLContextGuard(gl.domElement, onContextLost), [gl, onContextLost]);
  return null;
}

export function DioramaCanvas({ onContextLost, onInteract, onReady, quality, reducedMotion, request }: DioramaCanvasProps) {
  return (
    <Canvas
      aria-label="نمای سه‌بعدی ویلای مفهومی در جنگل هیرکانی"
      frameloop="demand"
      camera={{ position: [15.5, 10.8, 19.5], fov: 38, near: 0.1, far: 80 }}
      dpr={quality.dpr}
      shadows={quality.shadows}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.outputColorSpace = SRGBColorSpace;
        gl.toneMapping = ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.04;
      }}
    >
      <Suspense fallback={null}>
        <HyrcanianWorld quality={quality} />
        <CameraRig request={request} reducedMotion={reducedMotion} onInteract={onInteract} />
        <ContextGuard onContextLost={onContextLost} />
        <FirstFrame onReady={onReady} />
      </Suspense>
    </Canvas>
  );
}
