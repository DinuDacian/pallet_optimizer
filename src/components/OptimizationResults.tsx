"use client";

import { useState, useMemo, useCallback } from "react";
import type { Box, PlacedBox } from "@/lib/types";
import { PalletVisualizer } from "@/components/pallet-visualizer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Weight, Play } from "lucide-react";

interface OptimizationResultsProps {
  placedBoxes: PlacedBox[];
  unplacedBoxes: Box[];
  boxesForVisualizer: PlacedBox[];
  hoveredBoxId: string | null;
  setHoveredBoxId: (id: string | null) => void;
  isLoading: boolean;
  palletDimensions: { width: number; length: number; maxHeight: number };
  isAnimating: boolean;
  startAnimation: () => void;
}

export function OptimizationResults({
  placedBoxes,
  unplacedBoxes,
  boxesForVisualizer,
  hoveredBoxId,
  setHoveredBoxId,
  isLoading,
  palletDimensions,
  isAnimating,
  startAnimation,
}: OptimizationResultsProps) {
  const [activeTab, setActiveTab] = useState("visualizer");

  return (
    <Card className="shadow-lg h-full min-h-[80vh]">
      <CardContent className="p-0 h-full">
        <Tabs
          defaultValue="visualizer"
          value={activeTab}
          onValueChange={setActiveTab}
          className="h-full flex flex-col"
        >
          <TabsList className="m-2">
            <TabsTrigger value="visualizer">3D Visualization</TabsTrigger>
            <TabsTrigger value="guide">Placement Guide</TabsTrigger>
          </TabsList>
          <Separator />
          <TabsContent value="visualizer" className="flex-grow relative mt-0">
            <PalletVisualizer
              placedBoxes={boxesForVisualizer}
              hoveredBoxId={hoveredBoxId}
              setHoveredBoxId={setHoveredBoxId}
              isLoading={isLoading}
              palletDimensions={palletDimensions}
            />
          </TabsContent>
          <TabsContent
            value="guide"
            className="flex-grow relative mt-0 flex flex-col"
          >
            <div className="p-2">
              <Button
                onClick={startAnimation}
                disabled={isAnimating || placedBoxes.length === 0}
              >
                <Play className="mr-2 h-4 w-4" />
                {isAnimating ? "Animating..." : "Start Animation"}
              </Button>
            </div>
            <ScrollArea className="h-[calc(80vh-80px)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Step</TableHead>
                    <TableHead>Box Dimensions</TableHead>
                    <TableHead>
                      <Weight className="inline-block w-4 h-4" /> Weight
                    </TableHead>
                    <TableHead>Position (x, y, z)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {placedBoxes.length > 0 ? (
                    placedBoxes.map((box, index) => (
                      <TableRow
                        key={box.id}
                        onMouseEnter={() => setHoveredBoxId(box.id)}
                        onMouseLeave={() => setHoveredBoxId(null)}
                        className="cursor-pointer"
                      >
                        <TableCell className="font-medium">
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div
                              style={{ backgroundColor: box.color }}
                              className="w-3 h-3 rounded-sm"
                            />
                            {box.length} x {box.width} x {box.height} cm
                          </div>
                        </TableCell>
                        <TableCell>{box.weight} kg</TableCell>
                        <TableCell>{`${box.x.toFixed(1)}, ${box.y.toFixed(
                          1
                        )}, ${box.z.toFixed(1)}`}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="h-48 text-center text-muted-foreground"
                      >
                        {isLoading
                          ? "Optimizing layout..."
                          : 'No optimized layout to show. Add boxes and click "Optimize".'}
                      </TableCell>
                    </TableRow>
                  )}
                  {unplacedBoxes.length > 0 && (
                    <>
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="font-bold text-destructive bg-destructive/10"
                        >
                          Unplaced Boxes
                        </TableCell>
                      </TableRow>
                      {unplacedBoxes.map((box) => (
                        <TableRow
                          key={box.id}
                          className="bg-destructive/10 text-destructive-foreground"
                        >
                          <TableCell className="font-medium">-</TableCell>
                          <TableCell>
                            {box.length} x {box.width} x {box.height} cm
                          </TableCell>
                          <TableCell>{box.weight} kg</TableCell>
                          <TableCell>Could not be placed</TableCell>
                        </TableRow>
                      ))}
                    </>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}