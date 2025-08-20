"use client";

import React, { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  CSS2DRenderer,
  CSS2DObject,
} from "three/examples/jsm/renderers/CSS2DRenderer.js";
import type { PlacedBox } from "@/lib/types";
import { PALLET_HEIGHT } from "@/lib/types";
import { Loader2, MousePointer } from "lucide-react";

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
}

function createGridTexture(width: number, length: number) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  const canvasSize = 512;
  const divisions = 10;
  canvas.width = canvasSize;
  canvas.height = canvasSize;

  if (!context) {
    return null;
  }

  context.fillStyle = "#8B5A2B"; // Pallet color
  context.fillRect(0, 0, canvasSize, canvasSize);

  context.strokeStyle = "rgba(0,0,0,0.2)";
  context.lineWidth = 2;

  // Draw grid lines
  for (let i = 0; i <= divisions; i++) {
    const x = (i / divisions) * canvasSize;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, canvasSize);
    context.stroke();

    const y = (i / divisions) * canvasSize;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(canvasSize, y);
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  // Scale texture to show grid lines approximately every 10cm
  texture.repeat.set(length / (divisions * 10), width / (divisions * 10));

  return texture;
}

export function PalletVisualizer({
  placedBoxes,
  hoveredBoxId,
  setHoveredBoxId,
  isLoading,
  palletDimensions,
}: PalletVisualizerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const boxMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const labelMeshesRef = useRef<Map<string, CSS2DObject>>(new Map());
  const palletMeshRef = useRef<THREE.Mesh | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const labelRendererRef = useRef<CSS2DRenderer | null>(null);
  const raycaster = new THREE.Raycaster();
  const [localHoveredBoxId, setLocalHoveredBoxId] = useState<string | null>(
    null
  );
  const [tooltipPosition, setTooltipPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const mouse = new THREE.Vector2();

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      if (!mountRef.current || !cameraRef.current || !sceneRef.current) return;

      const rect = mountRef.current.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, cameraRef.current);
      const boxMeshes = Array.from(boxMeshesRef.current.values());
      const intersects = raycaster.intersectObjects(boxMeshes);

      if (intersects.length > 0) {
        const intersectedObject = intersects[0].object as THREE.Mesh;
        const id = intersectedObject.userData.id;
        if (id !== localHoveredBoxId) {
          setLocalHoveredBoxId(id);
        }
        setTooltipPosition({ x: event.clientX, y: event.clientY });
      } else {
        if (localHoveredBoxId !== null) {
          setLocalHoveredBoxId(null);
          setTooltipPosition(null);
        }
      }
      if (tooltipPosition)
        setTooltipPosition({ x: event.clientX, y: event.clientY }); // Update position even if same box
    };

    const currentMount = mountRef.current;
    if (currentMount) {
      currentMount.addEventListener("mousemove", onMouseMove);
    }
    return () => {
      if (currentMount) {
        currentMount.removeEventListener("mousemove", onMouseMove);
      }
    };
  }, [localHoveredBoxId, tooltipPosition]);

  useEffect(() => {
    if (!mountRef.current) return;
    const currentMount = mountRef.current;

    const scene = new THREE.Scene();
    const cssColor = getComputedStyle(document.documentElement)
      .getPropertyValue("--card")
      .trim();
    let backgroundColor: THREE.Color | string =
      cssColor && cssColor !== "" ? cssColor : "#f5f5f5";
    try {
      scene.background = new THREE.Color(`hsl(${backgroundColor})`);
    } catch {
      scene.background = new THREE.Color("#f5f5f5");
    }
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      50,
      currentMount.clientWidth / currentMount.clientHeight,
      1,
      2000
    );
    camera.position.set(150, 150, 250);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    rendererRef.current = renderer;
    currentMount.appendChild(renderer.domElement);

    // Label Renderer
    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    labelRenderer.domElement.style.position = "absolute";
    labelRenderer.domElement.style.top = "0px";
    labelRenderer.domElement.style.pointerEvents = "none";
    labelRendererRef.current = labelRenderer;
    currentMount.appendChild(labelRenderer.domElement);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(50, 100, 75);
    scene.add(directionalLight);

    // Pallet
    const palletGeometry = new THREE.BoxGeometry(
      palletDimensions.length,
      PALLET_HEIGHT,
      palletDimensions.width
    );
    const gridTexture = createGridTexture(
      palletDimensions.width,
      palletDimensions.length
    );
    const palletMaterials = [
      new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.8 }), // right
      new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.8 }), // left
      new THREE.MeshStandardMaterial({ map: gridTexture, roughness: 0.8 }), // top
      new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.8 }), // bottom
      new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.8 }), // front
      new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.8 }), // back
    ];
    const palletMesh = new THREE.Mesh(palletGeometry, palletMaterials);
    palletMesh.position.y = -PALLET_HEIGHT / 2;
    scene.add(palletMesh);
    palletMeshRef.current = palletMesh;

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!mountRef.current || !cameraRef.current) return;
      cameraRef.current.aspect =
        mountRef.current.clientWidth / mountRef.current.clientHeight;
      cameraRef.current.updateProjectionMatrix();
      renderer.setSize(
        mountRef.current.clientWidth,
        mountRef.current.clientHeight
      );
      labelRenderer.setSize(
        mountRef.current.clientWidth,
        mountRef.current.clientHeight
      );
    };

    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      if (renderer.domElement.parentElement === currentMount) {
        currentMount.removeChild(renderer.domElement);
      }
      if (labelRenderer.domElement.parentElement === currentMount) {
        currentMount.removeChild(labelRenderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    const palletMesh = palletMeshRef.current;
    if (palletMesh) {
      palletMesh.geometry.dispose();
      palletMesh.geometry = new THREE.BoxGeometry(
        palletDimensions.length,
        PALLET_HEIGHT,
        palletDimensions.width
      );

      const newGridTexture = createGridTexture(
        palletDimensions.width,
        palletDimensions.length
      );
      const materials = palletMesh.material as THREE.MeshStandardMaterial[];
      if (materials[2] && newGridTexture) {
        if (materials[2].map) materials[2].map.dispose();
        materials[2].map = newGridTexture;
        materials[2].needsUpdate = true;
      }
    }

    if (cameraRef.current) {
      cameraRef.current.position.set(
        palletDimensions.length * 1.2,
        palletDimensions.maxHeight * 0.75,
        palletDimensions.width * 1.5
      );
    }
  }, [palletDimensions]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const existingIds = new Set(placedBoxes.map((b) => b.id));

    // Remove boxes that are no longer in placedBoxes
    boxMeshesRef.current.forEach((mesh, id) => {
      if (!existingIds.has(id)) {
        scene.remove(mesh);
        const label = labelMeshesRef.current.get(id);
        if (label) scene.remove(label);
        boxMeshesRef.current.delete(id);
        labelMeshesRef.current.delete(id);
      }
    });

    // Add or update boxes
    placedBoxes.forEach((box) => {
      let mesh = boxMeshesRef.current.get(box.id);

      const newGeometry = new THREE.BoxGeometry(
        box.rotatedLength,
        box.rotatedHeight,
        box.rotatedWidth
      );

      if (!mesh) {
        const material = new THREE.MeshStandardMaterial({
          color: box.color,
          transparent: true,
          opacity: 0.9,
        });
        mesh = new THREE.Mesh(newGeometry, material);
        mesh.userData = { id: box.id };

        const edges = new THREE.EdgesGeometry(newGeometry);
        const line = new THREE.LineSegments(
          edges,
          new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 })
        );
        line.renderOrder = 1; // Render lines on top
        line.name = "box-outline";
        mesh.add(line);

        scene.add(mesh);
        boxMeshesRef.current.set(box.id, mesh);

        // const labelDiv = document.createElement("div");
        // labelDiv.className =
        //   "text-xs bg-card/80 backdrop-blur-sm text-card-foreground px-2 py-1 rounded shadow-lg";
        // // labelDiv.textContent = `${box.length}x${box.width}x${box.height}`;
        // labelDiv.style.visibility = "hidden";

        // const label = new CSS2DObject(labelDiv);
        // label.position.set(0, box.rotatedHeight / 2 + 10, 0);
        // mesh.add(label);
        // labelMeshesRef.current.set(box.id, label);
      } else {
        // Update geometry
        mesh.geometry.dispose();
        mesh.geometry = newGeometry;

        // Update outline
        const oldLine = mesh.getObjectByName("box-outline");
        if (oldLine) {
          mesh.remove(oldLine);
        }
        const newEdges = new THREE.EdgesGeometry(newGeometry);
        const newLine = new THREE.LineSegments(
          newEdges,
          new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 })
        );
        newLine.renderOrder = 1;
        newLine.name = "box-outline";
        mesh.add(newLine);
      }
      const posX = box.x + box.rotatedLength / 2 - palletDimensions.length / 2;
      const posY = box.y + box.rotatedHeight / 2;
      const posZ = box.z + box.rotatedWidth / 2 - palletDimensions.width / 2;

      mesh.position.set(posX, posY, posZ);
    });
  }, [placedBoxes, palletDimensions]);

  useEffect(() => {
    boxMeshesRef.current.forEach((mesh, id) => {
      const material = mesh.material as THREE.MeshStandardMaterial;
      const label = labelMeshesRef.current.get(id);
      const isHovered = id === localHoveredBoxId || id === hoveredBoxId; // Use local and prop for highlight

      if (isHovered) {
        material.emissive.setHex(0x666666);
        material.opacity = 1;
        mesh.scale.set(1.02, 1.02, 1.02);
        if (label)
          (label.element as HTMLDivElement).style.visibility = "visible";
      } else {
        material.emissive.setHex(0x000000);
        material.opacity = 0.9;
        mesh.scale.set(1, 1, 1);
        if (label)
          (label.element as HTMLDivElement).style.visibility = "hidden";
      }
    });
  }, [localHoveredBoxId, hoveredBoxId]);

  return (
    <div className="w-full h-full relative" ref={mountRef}>
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm z-10">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
          <p className="mt-4 text-lg font-semibold">Optimizing...</p>
        </div>
      )}
      {!isLoading && placedBoxes.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm z-10 text-center p-4">
          <MousePointer className="w-16 h-16 text-muted-foreground" />
          <p className="mt-4 text-lg font-semibold text-muted-foreground">
            Ready for Visualization
          </p>
          <p className="text-sm text-muted-foreground">
            Add boxes, set pallet dimensions, and click "Optimize". Hover over
            boxes to see details.
          </p>
        </div>
      )}
      {localHoveredBoxId &&
        tooltipPosition &&
        (() => {
          const hoveredBox = placedBoxes.find(
            (box) => box.id === localHoveredBoxId
          );
          if (!hoveredBox) return null;
          return (
            <div
              style={{
                position: "fixed",
                top: `${tooltipPosition.y + 10}px`,
                left: `${tooltipPosition.x + 10}px`,
                transform: "translateY(-100%)",
                zIndex: 20,
                pointerEvents: "none",
              }}
              className="bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded shadow-lg"
            >
              {hoveredBox.name || "Unnamed Box"}
              <br />
              {hoveredBox.length.toFixed(1)} x {hoveredBox.width.toFixed(1)} x{" "}
              {hoveredBox.height.toFixed(1)} cm
              <br />
              {hoveredBox.weight.toFixed(1)} kg
            </div>
          );
        })()}
    </div>
  );
}
