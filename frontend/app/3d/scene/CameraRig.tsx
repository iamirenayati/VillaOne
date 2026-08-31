"use client";

import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { getViewpoint } from "./config.mjs";

export type CameraRequest = {
  id: string;
  sequence: number;
};

type CameraRigProps = {
  request: CameraRequest;
  reducedMotion: boolean;
  onInteract: () => void;
};

export function CameraRig({ request, reducedMotion, onInteract }: CameraRigProps) {
  const controls = useRef<OrbitControlsImpl>(null);
  const destinationPosition = useRef(new Vector3());
  const destinationTarget = useRef(new Vector3());
  const transitionActive = useRef(true);
  const { camera, invalidate } = useThree();

  useEffect(() => {
    const viewpoint = getViewpoint(request.id);
    destinationPosition.current.fromArray(viewpoint.position);
    destinationTarget.current.fromArray(viewpoint.target);
    transitionActive.current = true;

    if (reducedMotion) {
      camera.position.copy(destinationPosition.current);
      controls.current?.target.copy(destinationTarget.current);
      controls.current?.update();
      transitionActive.current = false;
    }

    invalidate();
  }, [camera, invalidate, reducedMotion, request.id, request.sequence]);

  useFrame((_, delta) => {
    if (!transitionActive.current || !controls.current) return;

    const blend = 1 - Math.exp(-delta * 4.2);
    camera.position.lerp(destinationPosition.current, blend);
    controls.current.target.lerp(destinationTarget.current, blend);
    controls.current.update();

    const hasArrived = camera.position.distanceToSquared(destinationPosition.current) < 0.002
      && controls.current.target.distanceToSquared(destinationTarget.current) < 0.002;

    if (hasArrived) {
      camera.position.copy(destinationPosition.current);
      controls.current.target.copy(destinationTarget.current);
      controls.current.update();
      transitionActive.current = false;
      return;
    }

    invalidate();
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.07}
      minDistance={8.5}
      maxDistance={19}
      minPolarAngle={0.72}
      maxPolarAngle={1.38}
      minAzimuthAngle={-1.25}
      maxAzimuthAngle={1.05}
      onStart={() => {
        transitionActive.current = false;
        onInteract();
      }}
      onChange={() => invalidate()}
    />
  );
}
