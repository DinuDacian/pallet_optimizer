export interface Box {
  id: string;
  width: number;
  height: number;
  length: number;
  weight: number;
  color: string;
}

export interface PlacedBox extends Box {
  x: number;
  y: number;
  z: number;
  rotatedWidth: number;
  rotatedLength: number;
  rotatedHeight: number;
}

// Standard EUR pallet dimensions in cm
export const PALLET_WIDTH = 80;
export const PALLET_LENGTH = 120;
export const PALLET_HEIGHT = 14.4;
export const PALLET_MAX_LOAD_HEIGHT = 200;
