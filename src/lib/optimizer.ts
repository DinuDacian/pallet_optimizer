import type { Box, PlacedBox, PalletLoad } from "./types";

const TOLERANCE = 1e-6;

// Reglaje:
const SUPPORT_RATIO_MIN = 0.75; // min. 75% bază sprijinită
const CENTER_MARGIN_CM = 5;     // penalizare CoM dacă se apropie la <5cm de margini

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
        Math.max(0, Math.min(candidate.z + candidate.rotatedWidth,  p.z + p.rotatedWidth)  - Math.max(candidate.z, p.z));
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
  if (candidate.y + candidate.rotatedHeight > pallet.maxHeight + TOLERANCE) return false;
  if (Math.abs(candidate.y) < TOLERANCE) return true;

  const { supportRatio, mainSupport } = computeSupport(candidate, placed);
  if (supportRatio + TOLERANCE < SUPPORT_RATIO_MIN) return false;

  // Regulă cerută: baza trebuie să fie cu >5 kg mai grea decât cutia de sus
  if (mainSupport) {
    const diff = mainSupport.weight - candidate.weight;
    if (diff <= 5 - TOLERANCE) return false;
  }
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
    // pe același nivel
    pts.push({ x: p.x + p.rotatedLength, y: p.y, z: p.z });
    pts.push({ x: p.x,                   y: p.y, z: p.z + p.rotatedWidth });
    pts.push({ x: p.x + p.rotatedLength, y: p.y, z: p.z + p.rotatedWidth });

    // la podea
    if (Math.abs(p.y) < TOLERANCE) {
      pts.push({ x: p.x + p.rotatedLength, y: 0, z: 0 });
      pts.push({ x: 0, y: 0, z: p.z + p.rotatedWidth });
    }

    // pe top-surface pentru stivuire
    const ty = p.y + p.rotatedHeight;
    pts.push({ x: p.x,                   y: ty, z: p.z });
    pts.push({ x: p.x + p.rotatedLength, y: ty, z: p.z });
    pts.push({ x: p.x,                   y: ty, z: p.z + p.rotatedWidth });
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

function palletExtents(placed: PlacedBox[]): { maxX: number; maxZ: number; totalWeight: number } {
  let maxX = 0, maxZ = 0, totalWeight = 0;
  for (const p of placed) {
    maxX = Math.max(maxX, p.x + p.rotatedLength);
    maxZ = Math.max(maxZ, p.z + p.rotatedWidth);
    totalWeight += p.weight;
  }
  return { maxX, maxZ, totalWeight };
}

function centerOfMassPenalty(
  placed: PlacedBox[],
  candidate: PlacedBox,
  pallet: { width: number; length: number }
): number {
  let sumW = candidate.weight;
  let sumX = candidate.weight * (candidate.x + candidate.rotatedLength / 2);
  let sumZ = candidate.weight * (candidate.z + candidate.rotatedWidth / 2);

  for (const p of placed) {
    const cx = p.x + p.rotatedLength / 2;
    const cz = p.z + p.rotatedWidth / 2;
    sumW += p.weight;
    sumX += p.weight * cx;
    sumZ += p.weight * cz;
  }
  const comX = sumX / sumW;
  const comZ = sumZ / sumW;

  const marginX = Math.min(comX, pallet.length - comX);
  const marginZ = Math.min(comZ, pallet.width - comZ);

  let penalty = 0;
  if (marginX < CENTER_MARGIN_CM) penalty += (CENTER_MARGIN_CM - marginX) / CENTER_MARGIN_CM;
  if (marginZ < CENTER_MARGIN_CM) penalty += (CENTER_MARGIN_CM - marginZ) / CENTER_MARGIN_CM;
  return penalty;
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

// ✅ verifică dacă o cutie poate încăpea pe palet în vreo rotație (inclusiv H<=maxHeight)
function fitsPalletAnyRotation(b: Box, pallet: { width: number; length: number; maxHeight: number }): boolean {
  for (const r of rotations6(b)) {
    if (r.l <= pallet.length + TOLERANCE &&
        r.w <= pallet.width  + TOLERANCE &&
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

  const { supportRatio, mainSupport } = computeSupport(cand, placed);
  const comPenalty = centerOfMassPenalty(placed, cand, pallet);

  // bonus când stivuim pe bază mult mai grea (>5 kg)
  let stackAdvantage = 0;
  if (mainSupport) {
    const extra = mainSupport.weight - cand.weight - 5;
    if (extra > 0) stackAdvantage = Math.min(1, extra / 20);
  }

  // ținem jos înălțimea (normY), compactăm footprint-ul (extX/Z),
  // recompensăm sprijinul și stivuirea pe bază grea
  return (
    3.0 * normY +
    1.3 * Math.max(extX, extZ) +
    0.6 * (extX + extZ) -
    0.25 * supportRatio +
    0.2 * comPenalty -
    0.15 * stackAdvantage
  );
}

function findBestFitForBoxOnPallet(
  boxToPlace: Box,
  load: PalletLoad,
  pallet: { width: number; length: number; maxHeight: number; maxWeight: number }
): PlacedBox | null {
  if (load.totalWeight + boxToPlace.weight > pallet.maxWeight + TOLERANCE) return null;

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
        rotatedWidth:  r.w,
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

// 🔥 comparator cerut: greutate prima; dacă |Δkg| ≤ 5 → volum desc (dim. mai mare)
function compareBoxesForPacking(a: Box, b: Box): number {
  const d = b.weight - a.weight;
  if (Math.abs(d) > 5) return d; // greutate desc
  const volA = a.length * a.width * a.height;
  const volB = b.length * b.width * b.height;
  if (volB !== volA) return volB - volA; // volum desc când Δkg≤5
  // fallback: înălțime desc, apoi lungime desc, apoi lățime desc
  if (b.height !== a.height) return b.height - a.height;
  if (b.length !== a.length) return b.length - a.length;
  return b.width - a.width;
}

// 📦 “grad de umplere” al unui palet (pentru a umple maxim paletii existenți)
function loadFullnessScore(load: PalletLoad, pallet: { width: number; length: number; maxWeight: number }): number {
  const wRatio = load.totalWeight / pallet.maxWeight;
  const { maxX, maxZ } = palletExtents(load.placedBoxes);
  const xRatio = Math.min(1, maxX / pallet.length);
  const zRatio = Math.min(1, maxZ / pallet.width);
  const fp = Math.max(xRatio, zRatio); // cât de mult din footprint e atins
  return 0.7 * wRatio + 0.3 * fp; // greutatea cântărește mai mult
}

export function optimizePacking(
  boxes: Box[],
  pallet: { width: number; length: number; maxHeight: number; maxWeight: number }
): { palletLoads: PalletLoad[]; unplacedBoxes: Box[] } {

  // 1) Elimină cutiile care nu pot încăpea NICIODATĂ pe palet (în nicio rotație)
  const viable: Box[] = [];
  const rejectedTooBig: Box[] = [];
  for (const b of boxes) {
    if (fitsPalletAnyRotation(b, pallet)) viable.push(b);
    else rejectedTooBig.push(b);
  }

  // 2) Sortare: greutate prima; dacă Δkg ≤ 5 → prioritate volum mai mare
  const sorted = [...viable].sort(compareBoxesForPacking);

  const palletLoads: PalletLoad[] = [];
  const unplacedBoxes: Box[] = [];

  let nextIndex = 0;

  for (const box of sorted) {
    let bestOverall: { load: PalletLoad; fit: PlacedBox; score: number } | null = null;

    // 3) ÎNCERCĂ ÎNTÂI PALEȚII EXISTENȚI, ÎN ORDINE DESC DUPĂ “UMPLERE”
    const loadsByFullness = [...palletLoads].sort(
      (a, b) => loadFullnessScore(b, pallet) - loadFullnessScore(a, pallet)
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
      load.totalWeight += fit.weight;
    } else {
      // 4) Deschide palet nou DOAR dacă nu încape pe niciunul existent
      const newLoad: PalletLoad = { palletIndex: nextIndex++, placedBoxes: [], totalWeight: 0 };
      const fitNew = findBestFitForBoxOnPallet(box, newLoad, pallet);
      if (fitNew) {
        newLoad.placedBoxes.push(fitNew);
        newLoad.totalWeight += fitNew.weight;
        palletLoads.push(newLoad);
      } else {
        unplacedBoxes.push(box);
      }
    }
  }

  // 5) Normalizează indexările
  palletLoads.sort((a, b) => a.palletIndex - b.palletIndex);
  palletLoads.forEach((load, idx) => {
    load.palletIndex = idx;
    load.placedBoxes.forEach(pb => (pb.palletIndex = idx));
  });

  // include și pe cele respinse din start (prea mari) ca neplasate
  unplacedBoxes.push(...rejectedTooBig);

  return { palletLoads, unplacedBoxes };
}
