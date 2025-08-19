// @/app/actions.ts
"use server";

import type { Box, PlacedBox } from '@/lib/types';
import { optimizePacking } from '@/lib/optimizer';

export async function runOptimization(boxes: Box[], pallet: {width: number, length: number, maxHeight: number}): Promise<{ placedBoxes: PlacedBox[]; unplacedBoxes: Box[] }> {
  try {
    // Artificial delay to show loading state
    await new Promise(resolve => setTimeout(resolve, 1500));
    if (boxes.length === 0) {
      return { placedBoxes: [], unplacedBoxes: [] };
    }
    const result = optimizePacking(boxes, pallet);
    return result;
  } catch (error) {
    console.error("Optimization failed:", error);
    // In a real app, you'd want more robust error handling
    throw new Error("The optimization process failed. Please try again.");
  }
}
