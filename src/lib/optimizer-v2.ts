import type { Box, PlacedBox, PalletLoad } from "./types";

const TOLERANCE = 1e-6; //

// Reglaje (geometrice):
const SUPPORT_RATIO_MIN = 0.75; // min. 75% din baza cutiei trebuie sprijinită
const CENTER_MARGIN_CM = 5;     // penalizare dacă centrul (geometric) se apropie de margini <5 cm

interface Point { x: number; y: number; z: number; }

function intersects(a: PlacedBox, b: PlacedBox): boolean {
    return (
        a.x < b.x + b.rotatedLength - TOLERANCE &&
        a.x + a.rotatedLength > b.x + TOLERANCE &&
        a.y < b.y + b.rotatedHeight - TOLERANCE &&
        a.y + a.rotatedHeight > b.y + TOLERANCE &&
        a.z < b.z + b.rotatedWidth - TOLERANCE &&
        a.z + a.rotatedWidth > b.z + TOLERANCE
    );
}

function canPlaceBox(
    box: PlacedBox,
    placed: PlacedBox[],
    pallet: { width: number; length: number; maxHeight: number }
): boolean {
    if (
        box.x < -TOLERANCE ||
        box.y < -TOLERANCE ||
        box.z < -TOLERANCE ||
        box.x + box.rotatedLength > pallet.length + TOLERANCE ||
        box.z + box.rotatedWidth > pallet.width + TOLERANCE ||
        box.y + box.rotatedHeight > pallet.maxHeight + TOLERANCE
    ) return false;
    for (const p of placed) if (intersects(box, p)) return false;
    return true;
}

function computeSupport(
    candidate: PlacedBox,
    placed: PlacedBox[]
): { supportedArea: number; supportRatio: number; mainSupport: PlacedBox | null } {
    let supportedArea = 0;
    let mainSupport: PlacedBox | null = null;
    let maxOverlap = 0;

    for (const p of placed) {
        if (Math.abs(p.y + p.rotatedHeight - candidate.y) < TOLERANCE) {
            const overlapX =
                Math.max(0, Math.min(candidate.x + candidate.rotatedLength, p.x + p.rotatedLength) - Math.max(candidate.x, p.x));
            const overlapZ =
                Math.max(0, Math.min(candidate.z + candidate.rotatedWidth, p.z + p.rotatedWidth) - Math.max(candidate.z, p.z));
            const area = overlapX * overlapZ;
            if (area > 0) {
                supportedArea += area;
                if (area > maxOverlap) {
                    maxOverlap = area;
                    mainSupport = p;
                }
            }
        }
    }
    const baseArea = candidate.rotatedLength * candidate.rotatedWidth;
    const supportRatio = baseArea > TOLERANCE ? supportedArea / baseArea : 0;
    return { supportedArea, supportRatio, mainSupport };
}

function isStable(
    candidate: PlacedBox,
    placed: PlacedBox[],
    pallet: { maxHeight: number }
): boolean {
    // nu depășim înălțimea
    if (candidate.y + candidate.rotatedHeight > pallet.maxHeight + TOLERANCE) return false;

    // pe podea ⇒ stabil
    if (Math.abs(candidate.y) < TOLERANCE) return true;

    const { supportRatio } = computeSupport(candidate, placed);
    // doar criteriu geometric de sprijin
    if (supportRatio + TOLERANCE < SUPPORT_RATIO_MIN) return false;

    return true;
}

function getStableYPosition(
    base: Omit<PlacedBox, "y"> & { _placedRef?: PlacedBox[] }
): number {
    let y = 0;
    const placedRef = base._placedRef ?? [];
    for (const p of placedRef) {
        if (
            base.x < p.x + p.rotatedLength - TOLERANCE &&
            base.x + base.rotatedLength > p.x + TOLERANCE &&
            base.z < p.z + p.rotatedWidth - TOLERANCE &&
            base.z + base.rotatedWidth > p.z + TOLERANCE
        ) {
            y = Math.max(y, p.y + p.rotatedHeight);
        }
    }
    return y;
}

/** Extreme points (podea + adiacențe pe fețe + colțuri de top pentru stivuire) */
function generateCandidatePoints(placed: PlacedBox[]): Point[] {
    const pts: Point[] = [{ x: 0, y: 0, z: 0 }];

    for (const p of placed) {
        // pe același nivel (p.y)
        pts.push({ x: p.x + p.rotatedLength, y: p.y, z: p.z });
        pts.push({ x: p.x, y: p.y, z: p.z + p.rotatedWidth });
        pts.push({ x: p.x + p.rotatedLength, y: p.y, z: p.z + p.rotatedWidth });

        // la podea (ajută să “umplem” golurile)
        if (Math.abs(p.y) < TOLERANCE) {
            pts.push({ x: p.x + p.rotatedLength, y: 0, z: 0 });
            pts.push({ x: 0, y: 0, z: p.z + p.rotatedWidth });
        }

        // pe suprafața de sus (stivuire)
        const ty = p.y + p.rotatedHeight;
        pts.push({ x: p.x, y: ty, z: p.z });
        pts.push({ x: p.x + p.rotatedLength, y: ty, z: p.z });
        pts.push({ x: p.x, y: ty, z: p.z + p.rotatedWidth });
        pts.push({ x: p.x + p.rotatedLength, y: ty, z: p.z + p.rotatedWidth });
    }

    const map = new Map<string, Point>();
    for (const p of pts) {
        const key = `${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)}`;
        if (!map.has(key)) map.set(key, p);
    }

    return [...map.values()].sort((a, b) => {
        if (Math.abs(a.y - b.y) > TOLERANCE) return a.y - b.y;
        if (Math.abs(a.z - b.z) > TOLERANCE) return a.z - b.z;
        return a.x - b.x;
    });
}

function palletExtents(placed: PlacedBox[]): { maxX: number; maxZ: number } {
    let maxX = 0, maxZ = 0;
    for (const p of placed) {
        maxX = Math.max(maxX, p.x + p.rotatedLength);
        maxZ = Math.max(maxZ, p.z + p.rotatedWidth);
    }
    return { maxX, maxZ };
}

// Centru geometric al ariei ocupate (nu folosește greutăți)
function centerOfAreaPenalty(
    placed: PlacedBox[],
    candidate: PlacedBox,
    pallet: { width: number; length: number }
): number {
    let sumA = candidate.rotatedLength * candidate.rotatedWidth;
    let sumX = sumA * (candidate.x + candidate.rotatedLength / 2);
    let sumZ = sumA * (candidate.z + candidate.rotatedWidth / 2);

    for (const p of placed) {
        const area = p.rotatedLength * p.rotatedWidth;
        const cx = p.x + p.rotatedLength / 2;
        const cz = p.z + p.rotatedWidth / 2;
        sumA += area;
        sumX += area * cx;
        sumZ += area * cz;
    }
    const comX = sumX / sumA;
    const comZ = sumZ / sumA;

    const marginX = Math.min(comX, pallet.length - comX);
    const marginZ = Math.min(comZ, pallet.width - comZ);

    let penalty = 0;
    if (marginX < CENTER_MARGIN_CM) penalty += (CENTER_MARGIN_CM - marginX) / CENTER_MARGIN_CM;
    if (marginZ < CENTER_MARGIN_CM) penalty += (CENTER_MARGIN_CM - marginZ) / CENTER_MARGIN_CM;
    return penalty; // [0..2]
}

function rotations6(b: Box): Array<{ l: number; w: number; h: number }> {
    const { length: L, width: W, height: H } = b;
    return [
        { l: L, w: W, h: H },
        { l: W, w: L, h: H },
        { l: L, w: H, h: W },
        { l: H, w: L, h: W },
        { l: W, w: H, h: L },
        { l: H, w: W, h: L },
    ];
}

// Verifică dacă încape pe palet în vreo rotație
function fitsPalletAnyRotation(
    b: Box,
    pallet: { width: number; length: number; maxHeight: number }
): boolean {
    for (const r of rotations6(b)) {
        if (r.l <= pallet.length + TOLERANCE &&
            r.w <= pallet.width + TOLERANCE &&
            r.h <= pallet.maxHeight + TOLERANCE) {
            return true;
        }
    }
    return false;
}

function scoreCandidate(
    cand: PlacedBox,
    placed: PlacedBox[],
    pallet: { width: number; length: number; maxHeight: number }
): number {
    const { maxX, maxZ } = palletExtents(placed);
    const extX = Math.max(maxX, cand.x + cand.rotatedLength) / pallet.length;
    const extZ = Math.max(maxZ, cand.z + cand.rotatedWidth) / pallet.width;
    const normY = cand.y / pallet.maxHeight;

    const { supportRatio } = computeSupport(cand, placed);
    const comPenalty = centerOfAreaPenalty(placed, cand, pallet);

    // preferăm cutii cât mai jos, footprint compact, sprijin mare, centru geometric mai spre mijloc
    return (
        3.0 * normY +
        1.3 * Math.max(extX, extZ) +
        0.6 * (extX + extZ) -
        0.25 * supportRatio +
        0.2 * comPenalty
    );
}

function findBestFitForBoxOnPallet(
    boxToPlace: Box,
    load: PalletLoad,
    pallet: { width: number; length: number; maxHeight: number; maxWeight: number } // maxWeight ignorat
): PlacedBox | null {
    const placed = load.placedBoxes;
    const points = generateCandidatePoints(placed);

    let best: { cand: PlacedBox; score: number } | null = null;

    for (const pt of points) {
        for (const r of rotations6(boxToPlace)) {
            const base: Omit<PlacedBox, "y"> & { _placedRef?: PlacedBox[] } = {
                ...boxToPlace,
                x: pt.x,
                z: pt.z,
                rotatedLength: r.l,
                rotatedWidth: r.w,
                rotatedHeight: r.h,
                palletIndex: load.palletIndex,
                _placedRef: placed,
            };

            const y = getStableYPosition(base);
            const cand: PlacedBox = { ...(base as any), y };

            if (!canPlaceBox(cand, placed, pallet)) continue;
            if (!isStable(cand, placed, pallet)) continue;

            const sc = scoreCandidate(cand, placed, pallet);
            if (!best || sc < best.score - 1e-9) best = { cand, score: sc };
        }
    }

    return best ? best.cand : null;
}

// Comparator doar pe DIMENSIUNI: volum desc, apoi max(L,W,H) desc, apoi H desc, L desc, W desc
function compareBoxesBySize(a: Box, b: Box): number {
    const volA = a.length * a.width * a.height;
    const volB = b.length * b.width * b.height;
    if (volB !== volA) return volB - volA;
    const maxA = Math.max(a.length, a.width, a.height);
    const maxB = Math.max(b.length, b.width, b.height);
    if (maxB !== maxA) return maxB - maxA;
    if (b.height !== a.height) return b.height - a.height;
    if (b.length !== a.length) return b.length - a.length;
    return b.width - a.width;
}

// “Grad de umplere” pur geometric (fără greutate)
function loadFullnessScore(
    load: PalletLoad,
    pallet: { width: number; length: number; maxHeight: number }
): number {
    const { maxX, maxZ } = palletExtents(load.placedBoxes);
    const xRatio = Math.min(1, maxX / pallet.length);
    const zRatio = Math.min(1, maxZ / pallet.width);
    const fp = Math.max(xRatio, zRatio); // footprint coverage

    let maxTop = 0;
    for (const p of load.placedBoxes) {
        maxTop = Math.max(maxTop, p.y + p.rotatedHeight);
    }
    const hRatio = Math.min(1, maxTop / pallet.maxHeight);

    // footprint contează mai mult, dar ținem cont și de înălțime
    return 0.65 * fp + 0.35 * hRatio;
}

export function optimizePackingWithoutWeightFilter(
    boxes: Box[],
    pallet: { width: number; length: number; maxHeight: number; maxWeight: number } // maxWeight ignorat
): { palletLoads: PalletLoad[]; unplacedBoxes: Box[] } {

    // 1) aruncă din start cutiile care NU încap în nicio rotație (geometric)
    const viable: Box[] = [];
    const rejectedTooBig: Box[] = [];
    for (const b of boxes) {
        if (fitsPalletAnyRotation(b, pallet)) viable.push(b);
        else rejectedTooBig.push(b);
    }

    // 2) sortează DOAR pe dimensiuni
    const sorted = [...viable].sort(compareBoxesBySize);

    const palletLoads: PalletLoad[] = [];
    const unplacedBoxes: Box[] = [];

    let nextIndex = 0;

    for (const box of sorted) {
        let bestOverall: { load: PalletLoad; fit: PlacedBox; score: number } | null = null;

        // 3) încearcă ÎNTÂI pe paleții existenți, ordonați după umplere geometrică (desc)
        const loadsByFullness = [...palletLoads].sort(
            (a, b) =>
                loadFullnessScore(b, pallet) - loadFullnessScore(a, pallet)
        );

        for (const load of loadsByFullness) {
            const fit = findBestFitForBoxOnPallet(box, load, pallet);
            if (!fit) continue;
            const score = scoreCandidate(fit, load.placedBoxes, pallet);
            if (!bestOverall || score < bestOverall.score - 1e-9) {
                bestOverall = { load, fit, score };
            }
        }

        if (bestOverall) {
            const { load, fit } = bestOverall;
            fit.palletIndex = load.palletIndex;
            load.placedBoxes.push(fit);
            // totalWeight există în tip, dar e irelevant aici; îl lăsăm neschimbat sau îl incrementăm opțional
            // load.totalWeight += fit.weight; // IGNORAT în deciziile algoritmului
        } else {
            // 4) dacă nu încape nicăieri, deschide un palet nou
            const newLoad: PalletLoad = { palletIndex: nextIndex++, placedBoxes: [], totalWeight: 0 };
            const fitNew = findBestFitForBoxOnPallet(box, newLoad, pallet);
            if (fitNew) {
                newLoad.placedBoxes.push(fitNew);
                // newLoad.totalWeight += fitNew.weight; // ignorat
                palletLoads.push(newLoad);
            } else {
                unplacedBoxes.push(box);
            }
        }
    }

    // 5) normalizează indexările
    palletLoads.sort((a, b) => a.palletIndex - b.palletIndex);
    palletLoads.forEach((load, idx) => {
        load.palletIndex = idx;
        load.placedBoxes.forEach(pb => (pb.palletIndex = idx));
    });

    // atașează și cutiile respinse din start
    unplacedBoxes.push(...rejectedTooBig);

    return { palletLoads, unplacedBoxes };
}
