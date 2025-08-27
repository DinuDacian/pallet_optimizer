// @/app/actions.ts
"use server";

import type { Box, PalletLoad } from '@/lib/types';
import { optimizePacking } from '@/lib/optimizer';
import { optimizePackingWithoutWeightFilter } from '@/lib/optimizer-v2';

export async function runOptimization(boxes: Box[], pallet: { width: number, length: number, maxHeight: number, maxWeight: number }): Promise<{ palletLoads: PalletLoad[]; unplacedBoxes: Box[] }> {
  try {
    // Artificial delay to show loading state
    await new Promise(resolve => setTimeout(resolve, 1500));
    if (boxes.length === 0) {
      return { palletLoads: [], unplacedBoxes: [] };
    }
    const result = optimizePacking(boxes, pallet);
    // For testing without weight constraints, uncomment the line below and comment out the line above
    // const result = optimizePackingWithoutWeightFilter(boxes, pallet); // For testing without weight constraints
    return result;
  } catch (error) {
    console.error("Optimization failed:", error);
    // In a real app, you'd want more robust error handling
    throw new Error("The optimization process failed. Please try again.");
  }
}
