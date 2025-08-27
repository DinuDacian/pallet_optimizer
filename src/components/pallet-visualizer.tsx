"use client";

import React, { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import type { PlacedBox } from "@/lib/types";
import { PALLET_HEIGHT } from "@/lib/types";
import { Loader2, MousePointer, Undo2 } from "lucide-react";
import { Button } from "./ui/button";

interface PalletVisualizerProps {
  placedBoxes: PlacedBox[];
  hoveredBoxId: string | null;
  setHoveredBoxId: (id: string | null) => void;
  isLoading: boolean;
  palletDimensions: {
    width: number;
    length: number;
    maxHeight: number;
  };
  palletCount: number;
}

function createGridTexture(width: number, length: number) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const canvasSize = 512;
  const divisions = 10;
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  if (!ctx) return null;

  ctx.fillStyle = "#8B5A2B";
  ctx.fillRect(0, 0, canvasSize, canvasSize);

  ctx.strokeStyle = "rgba(0,0,0,0.2)";
  ctx.lineWidth = 2;
  for (let i = 0; i <= divisions; i++) {
    const x = (i / divisions) * canvasSize;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvasSize);
    ctx.stroke();

    const y = (i / divisions) * canvasSize;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvasSize, y);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(length / (divisions * 10), width / (divisions * 10));
  return texture;
}

// ridicare dinamică a etichetei deasupra cutiei (unități scenă)
const labelLift = (rotatedHeight: number) => Math.max(6, Math.min(24, rotatedHeight * 0.12));

export function PalletVisualizer({
  placedBoxes,
  hoveredBoxId,
  setHoveredBoxId,
  isLoading,
  palletDimensions,
  palletCount,
}: PalletVisualizerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const boxMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const labelMeshesRef = useRef<Map<string, CSS2DObject>>(new Map());
  const palletGroupRef = useRef<THREE.Group>(new THREE.Group());
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const labelRendererRef = useRef<CSS2DRenderer | null>(null);
  const raycaster = new THREE.Raycaster();
  const [localHoveredBoxId, setLocalHoveredBoxId] = useState<string | null>(null);
  const [focusedPalletIndex, setFocusedPalletIndex] = useState<number | null>(null);
  const animationFrameId = useRef<number>();

  const PALLET_SPACING = 50;

  // target-uri + flag pentru animația camerei doar când trebuie
  const cameraTargetPos = useRef(new THREE.Vector3());
  const controlsTargetPos = useRef(new THREE.Vector3());
  const isAnimatingCamera = useRef(false);

  // helper: traversează până la un părinte marcat (isBox / isPallet)
  const getTaggedAncestor = (obj: THREE.Object3D | null) => {
    let o: THREE.Object3D | null = obj;
    while (o) {
      if (o.userData?.isBox || o.userData?.isPallet) return o;
      o = o.parent as THREE.Object3D | null;
    }
    return null;
  };

  const resetCameraView = () => {
    setFocusedPalletIndex(null);
    if (cameraRef.current && controlsRef.current) {
      const totalWidth = palletCount * palletDimensions.length + (palletCount - 1) * PALLET_SPACING;
      cameraTargetPos.current.set(
        0,
        palletDimensions.maxHeight * 1.5,
        palletDimensions.width * 2 + totalWidth * 0.5
      );
      controlsTargetPos.current.set(0, 0, 0);
      isAnimatingCamera.current = true; // animăm DOAR acum
    }
    // reafișează toate paletele
    palletGroupRef.current.children.forEach((child) => {
      if (child.userData.isPallet) child.visible = true;
    });
  };

  const getIntersectedObject = (event: MouseEvent) => {
    if (!mountRef.current || !cameraRef.current) return null;
    const mouse = new THREE.Vector2();
    const rect = mountRef.current.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1); // corect

    raycaster.setFromCamera(mouse, cameraRef.current);

    const meshes = [
      ...Array.from(boxMeshesRef.current.values()),
      ...palletGroupRef.current.children.filter((c) => c.userData.isPallet),
    ];
    // recursive = true ca să prindă și children (ex. outline)
    const intersects = raycaster.intersectObjects(meshes, true);
    if (!intersects.length) return null;
    return getTaggedAncestor(intersects[0].object) as THREE.Object3D | null;
  };

  const focusOnPallet = (palletIndex: number) => {
    setFocusedPalletIndex(palletIndex);
    const targetPallet = palletGroupRef.current.children.find((c) => c.userData.palletIndex === palletIndex);
    if (!targetPallet || !cameraRef.current || !controlsRef.current) return;
    const targetPosition = new THREE.Vector3();
    targetPallet.getWorldPosition(targetPosition);
    controlsTargetPos.current.copy(targetPosition);

    const newCameraPos = new THREE.Vector3(
      targetPosition.x,
      targetPosition.y + palletDimensions.maxHeight * 0.75,
      targetPosition.z + palletDimensions.width * 1.8
    );
    cameraTargetPos.current.copy(newCameraPos);
    isAnimatingCamera.current = true; // pornesc animarea focusului
  };

  const onCanvasClick = (event: MouseEvent) => {
    const obj = getIntersectedObject(event);
    if (!obj) {
      if (focusedPalletIndex !== null) resetCameraView();
      return;
    }
    // funcționează atât pentru pallet cât și pentru box (folosim userData.palletIndex)
    const palletIndex = obj.userData?.palletIndex;
    if (typeof palletIndex === "number") {
      if (focusedPalletIndex === palletIndex) {
        resetCameraView();
      } else {
        focusOnPallet(palletIndex);
      }
    }
  };

  const onMouseMove = (event: MouseEvent) => {
    if (!mountRef.current || !cameraRef.current || !sceneRef.current) return;

    const mouse = new THREE.Vector2();
    const rect = mountRef.current.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1); // corect

    raycaster.setFromCamera(mouse, cameraRef.current);
    const boxMeshes = Array.from(boxMeshesRef.current.values());
    const intersects = raycaster.intersectObjects(boxMeshes, true);
    if (intersects.length > 0) {
      const hit = getTaggedAncestor(intersects[0].object);
      const hoveredId = hit?.userData?.id as string | undefined;
      if (hoveredId && hoveredId !== localHoveredBoxId) {
        // permite hover chiar și în focus mode
        setLocalHoveredBoxId(hoveredId);
      }
    } else if (localHoveredBoxId !== null) {
      setLocalHoveredBoxId(null);
    }
  };

  useEffect(() => {
    if (!mountRef.current) return;
    const currentMount = mountRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#A9A7A5");
    sceneRef.current = scene;
    scene.add(palletGroupRef.current);

    const camera = new THREE.PerspectiveCamera(
      50,
      currentMount.clientWidth / currentMount.clientHeight,
      1,
      5000
    );
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    rendererRef.current = renderer;
    currentMount.appendChild(renderer.domElement);

    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    labelRenderer.domElement.style.position = "absolute";
    labelRenderer.domElement.style.top = "0px";
    labelRenderer.domElement.style.pointerEvents = "none";
    labelRendererRef.current = labelRenderer;
    currentMount.appendChild(labelRenderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = true;
    controlsRef.current = controls;

    // sincronizează animația / interacțiunea
    controls.addEventListener("start", () => {
      isAnimatingCamera.current = false; // utilizatorul preia controlul
      cameraTargetPos.current.copy(camera.position);
      controlsTargetPos.current.copy(controls.target);
    });
    controls.addEventListener("change", () => {
      if (!isAnimatingCamera.current) {
        cameraTargetPos.current.copy(camera.position);
        controlsTargetPos.current.copy(controls.target);
      }
    });

    resetCameraView();
    camera.position.copy(cameraTargetPos.current);
    controls.target.copy(controlsTargetPos.current);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(50, 100, 75);
    scene.add(directionalLight);

    const animate = () => {
      animationFrameId.current = requestAnimationFrame(animate);

      // animează doar când trebuie, altfel lasă OrbitControls să conducă
      if (isAnimatingCamera.current && cameraRef.current && controlsRef.current) {
        cameraRef.current.position.lerp(cameraTargetPos.current, 0.1);
        controlsRef.current.target.lerp(controlsTargetPos.current, 0.1);

        // finalizează animația când suntem suficient de aproape
        if (
          cameraRef.current.position.distanceToSquared(cameraTargetPos.current) < 0.5 &&
          controlsRef.current.target.distanceToSquared(controlsTargetPos.current) < 0.25
        ) {
          cameraRef.current.position.copy(cameraTargetPos.current);
          controlsRef.current.target.copy(controlsTargetPos.current);
          isAnimatingCamera.current = false;
        }
      }

      controls.update();
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current || !cameraRef.current) return;
      cameraRef.current.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      cameraRef.current.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
      labelRenderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };

    window.addEventListener("resize", handleResize);
    currentMount.addEventListener("dblclick", onCanvasClick); // folosești dblclick — las așa
    currentMount.addEventListener("mousemove", onMouseMove);

    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      window.removeEventListener("resize", handleResize);
      if (currentMount) {
        currentMount.removeEventListener("dblclick", onCanvasClick);
        currentMount.removeEventListener("mousemove", onMouseMove);
      }
      if (renderer.domElement.parentElement === currentMount) currentMount.removeChild(renderer.domElement);
      if (labelRenderer.domElement.parentElement === currentMount) currentMount.removeChild(labelRenderer.domElement);
    };
  }, []);

  // Rebuild pallets when dimensions/count change
  useEffect(() => {
    const group = palletGroupRef.current;
    while (group.children.length) {
      const child = group.children[0];
      group.remove(child);
      if ((child as any).geometry) (child as THREE.Mesh).geometry.dispose();
      const mat = (child as any).material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else if (mat) mat.dispose();
    }

    const palletGeometry = new THREE.BoxGeometry(
      palletDimensions.length,
      PALLET_HEIGHT,
      palletDimensions.width
    );
    const gridTexture = createGridTexture(palletDimensions.width, palletDimensions.length);
    const palletMaterials = [
      new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.8 }),
      new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.8 }),
      new THREE.MeshStandardMaterial({ map: gridTexture ?? undefined, roughness: 0.8 }),
      new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.8 }),
      new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.8 }),
      new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.8 }),
    ];

    for (let i = 0; i < palletCount; i++) {
      const palletMesh = new THREE.Mesh(palletGeometry.clone(), palletMaterials);
      palletMesh.position.y = -PALLET_HEIGHT / 2;
      palletMesh.position.x = i * (palletDimensions.length + PALLET_SPACING);
      palletMesh.userData = { isPallet: true, palletIndex: i };
      palletGroupRef.current.add(palletMesh);
    }

    const totalWidth = palletCount * palletDimensions.length + (palletCount - 1) * PALLET_SPACING;
    palletGroupRef.current.position.x = -totalWidth / 2 + palletDimensions.length / 2;

    resetCameraView();
  }, [palletDimensions, palletCount]);

  // Vizibilitate în funcție de focus
  useEffect(() => {
    const group = palletGroupRef.current;
    group.children.forEach((child) => {
      if (child.userData.isPallet) {
        child.visible = focusedPalletIndex === null || child.userData.palletIndex === focusedPalletIndex;
      }
    });

    boxMeshesRef.current.forEach((mesh) => {
      const palletIndex = mesh.userData.palletIndex;
      mesh.visible = focusedPalletIndex === null || palletIndex === focusedPalletIndex;
    });
  }, [focusedPalletIndex, placedBoxes]);

  // Add/update boxes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const existingIds = new Set(placedBoxes.map((b) => b.id));

    // remove missing meshes
    boxMeshesRef.current.forEach((mesh, id) => {
      if (!existingIds.has(id)) {
        scene.remove(mesh);
        const label = labelMeshesRef.current.get(id);
        if (label) {
          mesh.remove(label);
          label.element.remove();
        }
        mesh.geometry.dispose();
        if (mesh.material instanceof THREE.Material) mesh.material.dispose();
        boxMeshesRef.current.delete(id);
        labelMeshesRef.current.delete(id);
      }
    });

    placedBoxes.forEach((box) => {
      let mesh = boxMeshesRef.current.get(box.id);
      const geom = new THREE.BoxGeometry(box.rotatedLength, box.rotatedHeight, box.rotatedWidth);

      if (!mesh) {
        const material = new THREE.MeshStandardMaterial({
          color: box.color,
          transparent: true,
          opacity: 0.9,
        });
        mesh = new THREE.Mesh(geom, material);
        // marchează clar ca “box” pentru raycast-ancestor
        mesh.userData = { id: box.id, isBox: true, palletIndex: box.palletIndex };

        const edges = new THREE.EdgesGeometry(geom);
        const line = new THREE.LineSegments(
          edges,
          new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 })
        );
        line.renderOrder = 1;
        line.name = "box-outline";
        mesh.add(line);

        scene.add(mesh);
        boxMeshesRef.current.set(box.id, mesh);

        // label init
        const labelDiv = document.createElement("div");
        labelDiv.className =
          "text-xs bg-card/80 backdrop-blur-sm text-card-foreground px-2 py-1 rounded shadow-lg";
        labelDiv.style.visibility = "hidden";
        labelDiv.innerHTML =
          `<div class="text-xs">
             <div><strong>${box.name}</strong></div>
             <div>${box.length}×${box.width}×${box.height} cm</div>
             <div>${box.weight} kg</div>
           </div>`;

        const label = new CSS2DObject(labelDiv);
        label.position.set(0, box.rotatedHeight / 2 + labelLift(box.rotatedHeight), 0);
        mesh.add(label);
        labelMeshesRef.current.set(box.id, label);
      } else {
        // update geometry + outline
        mesh.geometry.dispose();
        mesh.geometry = geom;

        const oldLine = mesh.getObjectByName("box-outline") as THREE.LineSegments | undefined;
        if (oldLine) {
          oldLine.geometry.dispose();
          mesh.remove(oldLine);
        }
        const newEdges = new THREE.EdgesGeometry(geom);
        const newLine = new THREE.LineSegments(
          newEdges,
          new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 })
        );
        newLine.renderOrder = 1;
        newLine.name = "box-outline";
        mesh.add(newLine);

        // 🔁 UPDATE label: poziție + conținut
        let label = labelMeshesRef.current.get(box.id);
        if (!label) {
          const labelDiv = document.createElement("div");
          labelDiv.className =
            "text-xs bg-card/80 backdrop-blur-sm text-card-foreground px-2 py-1 rounded shadow-lg";
          labelDiv.style.visibility = "hidden";
          label = new CSS2DObject(labelDiv);
          mesh.add(label);
          labelMeshesRef.current.set(box.id, label);
        }
        label.position.set(0, box.rotatedHeight / 2 + labelLift(box.rotatedHeight), 0);
        (label.element as HTMLDivElement).innerHTML =
          `<div class="text-xs">
             <div><strong>${box.name}</strong></div>
             <div>${box.length}×${box.width}×${box.height} cm</div>
             <div>${box.weight} kg</div>
           </div>`;
      }

      // poziționare mesh
      const groupX = palletGroupRef.current.position.x;
      const palletOffsetX = box.palletIndex * (palletDimensions.length + PALLET_SPACING);

      const posX = groupX + palletOffsetX + box.x + box.rotatedLength / 2 - palletDimensions.length / 2;
      const posY = box.y + box.rotatedHeight / 2;
      const posZ = box.z + box.rotatedWidth / 2 - palletDimensions.width / 2;

      mesh.position.set(posX, posY, posZ);
      mesh.userData.palletIndex = box.palletIndex;
    });
  }, [placedBoxes, palletDimensions.length, palletDimensions.width, palletCount]);

  // hover styling
  useEffect(() => {
    boxMeshesRef.current.forEach((mesh, id) => {
      const material = mesh.material as THREE.MeshStandardMaterial;
      const label = labelMeshesRef.current.get(id);
      const isHovered = id === localHoveredBoxId || id === hoveredBoxId;
      if (isHovered) {
        material.emissive.setHex(0x666666);
        material.opacity = 1;
        mesh.scale.set(1.02, 1.02, 1.02);
        if (label) (label.element as HTMLDivElement).style.visibility = "visible";
      } else {
        material.emissive.setHex(0x000000);
        material.opacity = 0.9;
        mesh.scale.set(1, 1, 1);
        if (label) (label.element as HTMLDivElement).style.visibility = "hidden";
      }
    });
  }, [localHoveredBoxId, hoveredBoxId]);

  return (
    <div className="w-full h-full relative" ref={mountRef}>
      {focusedPalletIndex !== null && (
        <Button
          variant="secondary"
          size="sm"
          className="absolute top-2 right-2 z-20"
          onClick={resetCameraView}
        >
          <Undo2 className="mr-2 h-4 w-4" />
          Reset View
        </Button>
      )}

      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm z-10">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
          <p className="mt-4 text-lg font-semibold">Optimizing...</p>
        </div>
      )}

      {!isLoading && placedBoxes.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm z-10 text-center p-4">
          <MousePointer className="w-16 h-16 text-muted-foreground" />
          <p className="mt-4 text-lg font-semibold text-muted-foreground">Ready for Visualization</p>
          <p className="text-sm text-muted-foreground">
            Add boxes, set pallet dimensions, and click "Optimize". Double-click a pallet to focus.
          </p>
        </div>
      )}
    </div>
  );
}
