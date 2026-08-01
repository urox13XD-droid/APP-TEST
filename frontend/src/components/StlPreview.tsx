"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

interface Props {
  stlUrl: string;
  /** bumped by the parent whenever the mesh should be reloaded (e.g. after an edit) */
  reloadToken: number | string;
}

export default function StlPreview({ stlUrl, reloadToken }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    setLoading(true);
    setError(null);

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f5);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 5000);
    camera.position.set(80, 80, 120);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(1, 1, 1);
    scene.add(dirLight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    let frameId: number;
    let mesh: THREE.Mesh | null = null;

    const loader = new STLLoader();
    loader.load(
      stlUrl,
      (geometry) => {
        geometry.center();
        geometry.computeVertexNormals();
        const material = new THREE.MeshStandardMaterial({ color: 0x2563eb, metalness: 0.1, roughness: 0.6 });
        mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2; // extrusion axis -> up
        scene.add(mesh);

        geometry.computeBoundingSphere();
        const radius = geometry.boundingSphere?.radius ?? 50;
        camera.position.set(radius * 1.5, radius * 1.5, radius * 2);
        controls.target.set(0, 0, 0);
        controls.update();

        setLoading(false);
      },
      undefined,
      (err) => {
        setError(err instanceof Error ? err.message : "Impossible de charger le STL");
        setLoading(false);
      }
    );

    function animate() {
      controls.update();
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    }
    animate();

    function handleResize() {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
      controls.dispose();
      renderer.dispose();
      container.innerHTML = "";
    };
  }, [stlUrl, reloadToken]);

  return (
    <div className="relative h-80 w-full overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
      <div ref={containerRef} className="h-full w-full" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/60 text-sm dark:bg-black/40">
          Chargement du modèle 3D…
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 text-sm text-red-500 dark:bg-black/60">
          {error}
        </div>
      )}
    </div>
  );
}
