"use client";

import { ForestInstances } from "./ForestInstances";
import { VillaSculpture } from "./VillaSculpture";

type QualityProfile = ReturnType<typeof import("./config.mjs").selectQualityProfile>;

const MOTES: [number, number, number][] = [
  [-5.2, 3.8, 1.8], [-3.6, 5.1, -2.4], [-1.4, 4.6, 4.2], [1.2, 5.4, 3.6],
  [3.7, 4.1, -3.1], [5.6, 5.9, 1.1], [7.2, 3.6, 4.4], [-7.4, 4.8, -1.2],
];

export function HyrcanianWorld({ quality }: { quality: QualityProfile }) {
  return (
    <>
      <color attach="background" args={["#06130f"]} />
      <fogExp2 attach="fog" args={["#0a2119", 0.034]} />
      <hemisphereLight args={["#769386", "#07120e", 1.5]} />
      <directionalLight
        position={[8, 12, 6]}
        intensity={2.1}
        color="#e7d4ad"
        castShadow={quality.shadows}
        shadow-mapSize-width={quality.shadowMapSize}
        shadow-mapSize-height={quality.shadowMapSize}
        shadow-camera-near={2}
        shadow-camera-far={34}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
      />
      <pointLight position={[-7, 4, 7]} color="#3d8971" intensity={9} distance={19} decay={2} />

      <group position={[0, -0.68, 0]}>
        <mesh receiveShadow={quality.shadows} position={[0, -0.65, 0]} rotation={[0, 0.12, 0]}>
          <cylinderGeometry args={[9.8, 11.2, 1.35, 16]} />
          <meshStandardMaterial color="#0a1c15" roughness={1} />
        </mesh>
        <mesh receiveShadow={quality.shadows} position={[-0.35, 0.02, -0.1]} rotation={[0, -0.07, 0]}>
          <cylinderGeometry args={[9.25, 9.8, 0.55, 16]} />
          <meshStandardMaterial color="#294c38" roughness={.96} />
        </mesh>
        <mesh receiveShadow={quality.shadows} position={[1.25, 0.33, -0.85]} rotation={[0, 0.2, 0]}>
          <cylinderGeometry args={[6.7, 7.25, 0.35, 14]} />
          <meshStandardMaterial color="#365e42" roughness={.94} />
        </mesh>
      </group>

      <mesh position={[-2.2, -0.08, 5.65]} rotation={[-Math.PI / 2, 0, -0.11]} receiveShadow={quality.shadows}>
        <planeGeometry args={[8.4, 2.45, 1, 1]} />
        <meshPhysicalMaterial color="#244f4a" roughness={0.12} metalness={0.28} transmission={0.08} transparent opacity={0.88} />
      </mesh>
      <mesh position={[5.5, 0.06, 1.4]} rotation={[-Math.PI / 2, 0, 0.38]} receiveShadow={quality.shadows}>
        <planeGeometry args={[5.8, 1.15]} />
        <meshStandardMaterial color="#a38f70" roughness={0.96} />
      </mesh>

      <VillaSculpture quality={quality} />
      <ForestInstances quality={quality} />

      {MOTES.map((position, index) => (
        <mesh key={index} position={position}>
          <sphereGeometry args={[0.035 + (index % 3) * 0.012, 8, 8]} />
          <meshBasicMaterial color="#e3b86f" toneMapped={false} />
        </mesh>
      ))}
    </>
  );
}
