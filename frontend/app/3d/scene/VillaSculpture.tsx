"use client";

type QualityProfile = ReturnType<typeof import("./config.mjs").selectQualityProfile>;

function Volume({
  position,
  scale,
  color,
  shadows,
}: {
  position: [number, number, number];
  scale: [number, number, number];
  color: string;
  shadows: boolean;
}) {
  return (
    <mesh position={position} scale={scale} castShadow={shadows} receiveShadow={shadows}>
      <boxGeometry />
      <meshStandardMaterial color={color} roughness={0.74} metalness={0.04} />
    </mesh>
  );
}

export function VillaSculpture({ quality }: { quality: QualityProfile }) {
  const shadows = quality.shadows;
  const screenSlats = [-1.55, -1.23, -0.91, -0.59, -0.27, 0.05, 0.37];

  return (
    <group rotation={[0, -0.24, 0]} position={[0, 0.05, -0.2]}>
      <Volume position={[0, 0.38, 0]} scale={[7.1, 0.7, 5.35]} color="#777061" shadows={shadows} />
      <Volume position={[-0.65, 1.35, 0.1]} scale={[5.55, 1.55, 4.15]} color="#c9c0ae" shadows={shadows} />
      <Volume position={[0.7, 2.72, -0.4]} scale={[4.85, 1.25, 3.45]} color="#333b35" shadows={shadows} />
      <Volume position={[0.7, 3.48, -0.4]} scale={[5.3, 0.16, 3.82]} color="#1a211d" shadows={shadows} />
      <Volume position={[2.85, 1.06, 0.12]} scale={[1.05, 1.05, 3.95]} color="#a99c86" shadows={shadows} />

      <mesh position={[-0.45, 1.45, 2.19]} scale={[3.9, 1.02, 0.08]} castShadow={shadows}>
        <boxGeometry />
        <meshPhysicalMaterial color="#d69a4d" emissive="#b86e27" emissiveIntensity={1.25} roughness={0.2} metalness={0.1} transparent opacity={0.78} />
      </mesh>
      <mesh position={[0.82, 2.72, 1.36]} scale={[3.72, 0.78, 0.07]} castShadow={shadows}>
        <boxGeometry />
        <meshPhysicalMaterial color="#e2aa5d" emissive="#c8782c" emissiveIntensity={1.45} roughness={0.17} metalness={0.08} transparent opacity={0.72} />
      </mesh>

      <mesh position={[-2.7, 1.24, 1.6]} scale={[0.52, 1.28, 1.1]} castShadow={shadows} receiveShadow={shadows}>
        <boxGeometry />
        <meshStandardMaterial color="#57432f" roughness={0.82} />
      </mesh>
      {screenSlats.map((x) => (
        <mesh key={x} position={[x, 2.73, 1.62]} scale={[0.08, 1.08, 0.13]} castShadow={shadows}>
          <boxGeometry />
          <meshStandardMaterial color="#8b6844" roughness={0.68} />
        </mesh>
      ))}

      <mesh position={[-0.4, 0.93, 3.05]} scale={[6.4, 0.16, 1.58]} receiveShadow={shadows}>
        <boxGeometry />
        <meshStandardMaterial color="#918978" roughness={0.78} />
      </mesh>
      <mesh position={[-0.4, 1.08, 3.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[5.95, 1.18]} />
        <meshPhysicalMaterial color="#315e59" roughness={0.16} metalness={0.22} transmission={0.12} transparent opacity={0.9} />
      </mesh>

      <pointLight position={[-0.8, 1.65, 1.5]} color="#e7a451" intensity={18} distance={8} decay={2} />
      <pointLight position={[1.1, 2.85, 0.9]} color="#e4a154" intensity={13} distance={7} decay={2} />
    </group>
  );
}
