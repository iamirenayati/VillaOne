"use client";

import * as THREE from "three";
import { useLayoutEffect, useMemo, useRef } from "react";
import { createRockLayout, createTreeLayout } from "./layout.mjs";

type QualityProfile = ReturnType<typeof import("./config.mjs").selectQualityProfile>;

export function ForestInstances({ quality }: { quality: QualityProfile }) {
  const trunks = useRef<THREE.InstancedMesh>(null);
  const lowerCrowns = useRef<THREE.InstancedMesh>(null);
  const upperCrowns = useRef<THREE.InstancedMesh>(null);
  const rocksMesh = useRef<THREE.InstancedMesh>(null);
  const trees = useMemo(() => createTreeLayout(quality.trees), [quality.trees]);
  const rocks = useMemo(() => createRockLayout(quality.rocks), [quality.rocks]);

  useLayoutEffect(() => {
    const transform = new THREE.Object3D();
    trees.forEach((tree, index) => {
      transform.position.set(tree.x, tree.height * 0.34, tree.z);
      transform.rotation.set(0, tree.rotation, 0);
      transform.scale.set(tree.scale * 0.22, tree.height * 0.68, tree.scale * 0.22);
      transform.updateMatrix();
      trunks.current?.setMatrixAt(index, transform.matrix);

      transform.position.set(tree.x, tree.height * 0.78, tree.z);
      transform.scale.set(tree.scale * 1.15, tree.height * 0.22, tree.scale * 1.15);
      transform.updateMatrix();
      lowerCrowns.current?.setMatrixAt(index, transform.matrix);

      transform.position.set(tree.x, tree.height * 1.04, tree.z);
      transform.scale.set(tree.scale * 0.82, tree.height * 0.18, tree.scale * 0.82);
      transform.updateMatrix();
      upperCrowns.current?.setMatrixAt(index, transform.matrix);
    });
    for (const mesh of [trunks.current, lowerCrowns.current, upperCrowns.current]) {
      if (mesh) mesh.instanceMatrix.needsUpdate = true;
    }

    rocks.forEach((rock, index) => {
      transform.position.set(rock.x, 0.05, rock.z);
      transform.rotation.set(rock.rotation * 0.2, rock.rotation, rock.rotation * 0.12);
      transform.scale.set(rock.scale, rock.scale * 0.62, rock.scale * 0.78);
      transform.updateMatrix();
      rocksMesh.current?.setMatrixAt(index, transform.matrix);
    });
    if (rocksMesh.current) rocksMesh.current.instanceMatrix.needsUpdate = true;
  }, [rocks, trees]);

  return (
    <group>
      <instancedMesh ref={trunks} args={[undefined, undefined, quality.trees]} castShadow={quality.shadows} receiveShadow={quality.shadows}>
        <cylinderGeometry args={[0.45, 0.62, 1, 7]} />
        <meshStandardMaterial color="#4c3d2d" roughness={0.92} />
      </instancedMesh>
      <instancedMesh ref={lowerCrowns} args={[undefined, undefined, quality.trees]} castShadow={quality.shadows}>
        <coneGeometry args={[1, 2.2, 7]} />
        <meshStandardMaterial color="#214a35" roughness={0.86} />
      </instancedMesh>
      <instancedMesh ref={upperCrowns} args={[undefined, undefined, quality.trees]} castShadow={quality.shadows}>
        <coneGeometry args={[1, 2.1, 7]} />
        <meshStandardMaterial color="#2e6245" roughness={0.84} />
      </instancedMesh>
      <instancedMesh ref={rocksMesh} args={[undefined, undefined, quality.rocks]} castShadow={quality.shadows} receiveShadow={quality.shadows}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#657064" roughness={0.98} />
      </instancedMesh>
    </group>
  );
}
