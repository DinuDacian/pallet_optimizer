import type { Box, PlacedBox } from './types';

interface Point {
    x: number;
    y: number;
    z: number;
}

// Precision helpers
const lessThan = (a: number, b: number) => a < b - 1e-9;
const greaterThan = (a: number, b: number) => a > b + 1e-9;

// Collision detection
function intersects(box1: PlacedBox, box2: PlacedBox): boolean {
    return (
        lessThan(box1.x, box2.x + box2.rotatedLength) &&
        greaterThan(box1.x + box1.rotatedLength, box2.x) &&
        lessThan(box1.y, box2.y + box2.rotatedHeight) &&
        greaterThan(box1.y + box1.rotatedHeight, box2.y) &&
        lessThan(box1.z, box2.z + box2.rotatedWidth) &&
        greaterThan(box1.z + box1.rotatedWidth, box2.z)
    );
}

// Heuristic scoring
function score(box: PlacedBox): number {
    return box.y * 1000000 + box.z * 1000 + box.x;
}

export function optimizePacking(
    boxes: Box[],
    pallet: { width: number; length: number; maxHeight: number }
): { placedBoxes: PlacedBox[]; unplacedBoxes: Box[] } {
    const placedBoxes: PlacedBox[] = [];
    const unplacedBoxes: Box[] = [];

    const sortedBoxes = [...boxes].sort((a, b) => {
        if (b.weight !== a.weight) return b.weight - a.weight;
        const volA = a.length * a.width * a.height;
        const volB = b.length * b.width * b.height;
        if (volA !== volB) return volB - volA;
        const areaA = Math.max(a.length * a.width, a.length * a.height, a.width * a.height);
        const areaB = Math.max(b.length * b.width, b.length * b.height, b.width * b.height);
        if (areaA !== areaB) return areaB - areaA;
        return Math.max(b.length, b.width, b.height) - Math.max(a.length, a.width, a.height);
    });

    for (const boxToPlace of sortedBoxes) {
        let bestFit: PlacedBox | null = null;
        const placementPoints = new Map<string, Point>();
        const addPoint = (p: Point) => placementPoints.set(`${p.x},${p.y},${p.z}`, p);
        addPoint({ x: 0, y: 0, z: 0 });

        for (const pBox of placedBoxes) {
            addPoint({ x: pBox.x + pBox.rotatedLength, y: pBox.y, z: pBox.z });
            addPoint({ x: pBox.x, y: pBox.y, z: pBox.z + pBox.rotatedWidth });
            addPoint({ x: pBox.x, y: pBox.y + pBox.rotatedHeight, z: pBox.z });
            addPoint({ x: pBox.x + pBox.rotatedLength, y: pBox.y, z: pBox.z + pBox.rotatedWidth });
            addPoint({ x: pBox.x + pBox.rotatedLength, y: pBox.y + pBox.rotatedHeight, z: pBox.z });
            addPoint({ x: pBox.x, y: pBox.y + pBox.rotatedHeight, z: pBox.z + pBox.rotatedWidth });
        }

        const rotations = [
            { l: boxToPlace.length, w: boxToPlace.width, h: boxToPlace.height },
            { l: boxToPlace.length, w: boxToPlace.height, h: boxToPlace.width },
            { l: boxToPlace.width, w: boxToPlace.length, h: boxToPlace.height },
            { l: boxToPlace.width, w: boxToPlace.height, h: boxToPlace.length },
            { l: boxToPlace.height, w: boxToPlace.length, h: boxToPlace.width },
            { l: boxToPlace.height, w: boxToPlace.width, h: boxToPlace.length },
        ];

        for (const rotation of rotations) {
            for (const point of placementPoints.values()) {
                let candidate: PlacedBox = {
                    ...boxToPlace,
                    x: point.x,
                    y: point.y,
                    z: point.z,
                    rotatedLength: rotation.l,
                    rotatedWidth: rotation.w,
                    rotatedHeight: rotation.h,
                };

                if (
                    greaterThan(candidate.x + candidate.rotatedLength, pallet.length) ||
                    greaterThan(candidate.z + candidate.rotatedWidth, pallet.width) ||
                    greaterThan(candidate.y + candidate.rotatedHeight, pallet.maxHeight)
                ) continue;

                let collides = placedBoxes.some(pBox => intersects(candidate, pBox));
                if (collides) continue;

                let finalY = 0;
                for (const pBox of placedBoxes) {
                    if (
                        lessThan(candidate.x, pBox.x + pBox.rotatedLength) &&
                        greaterThan(candidate.x + candidate.rotatedLength, pBox.x) &&
                        lessThan(candidate.z, pBox.z + pBox.rotatedWidth) &&
                        greaterThan(candidate.z + candidate.rotatedWidth, pBox.z)
                    ) {
                        finalY = Math.max(finalY, pBox.y + pBox.rotatedHeight);
                    }
                }
                candidate.y = finalY;

                if (greaterThan(candidate.y + candidate.rotatedHeight, pallet.maxHeight)) continue;
                if (placedBoxes.some(pBox => intersects(candidate, pBox))) continue;

                if (!bestFit || score(candidate) < score(bestFit)) {
                    bestFit = candidate;
                }
            }
        }

        if (bestFit) {
            placedBoxes.push(bestFit);
        } else {
            unplacedBoxes.push(boxToPlace);
        }
    }

    return { placedBoxes, unplacedBoxes };
}