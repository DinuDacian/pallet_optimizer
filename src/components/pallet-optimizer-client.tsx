"use client";

import { useState, useCallback } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { runOptimization } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import type { Box, PlacedBox } from "@/lib/types";
import {
  PALLET_WIDTH,
  PALLET_LENGTH,
  PALLET_MAX_LOAD_HEIGHT,
} from "@/lib/types";
import { PalletForm, PalletFormData, palletSchema } from "./PalletForm";
import { AddBoxForm, BoxFormData, boxSchema } from "./AddBoxForm";
import { Button } from "@/components/ui/button";
import { PalletVisualizer } from "./pallet-visualizer";
import {
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  Table,
} from "./ui/table";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import {
  BoxIcon,
  Trash2,
  Loader2,
  Sparkles,
  RotateCw,
  Play,
  Weight,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Header } from "./shared/header/Header";
import { BoxList } from "./BoxList";
import { clear } from "console";

export function PalletOptimizerClient() {
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [placedBoxes, setPlacedBoxes] = useState<PlacedBox[]>([]);
  const [unplacedBoxes, setUnplacedBoxes] = useState<Box[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hoveredBoxId, setHoveredBoxId] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animatedBoxes, setAnimatedBoxes] = useState<PlacedBox[]>([]);
  const [activeTab, setActiveTab] = useState("visualizer");
  const { toast } = useToast();

  const boxForm = useForm<BoxFormData>({
    resolver: zodResolver(boxSchema),
    defaultValues: {
      length: 40,
      width: 30,
      height: 20,
      weight: 10,
    },
  });

  const randomHexColor = () =>
    `#${Math.floor(Math.random() * 16777215)
      .toString(16)
      .padEnd(6, "0")}`;

  const palletForm = useForm<PalletFormData>({
    resolver: zodResolver(palletSchema),
    defaultValues: {
      width: PALLET_WIDTH,
      length: PALLET_LENGTH,
      maxHeight: PALLET_MAX_LOAD_HEIGHT,
    },
  });

  const palletDimensions = palletForm.watch();

  const addBox: SubmitHandler<BoxFormData> = (data) => {
    const newBox: Box = {
      id: `box-${Date.now()}-${Math.random()}`,
      ...data,
      color: randomHexColor(),
    };
    setBoxes((prev) => [...prev, newBox]);
    boxForm.reset();
  };

  const removeBox = (id: string) => {
    setBoxes((prev) => prev.filter((box) => box.id !== id));
  };

  const handleOptimize = async () => {
    setIsLoading(true);
    setPlacedBoxes([]);
    setUnplacedBoxes([]);
    setIsAnimating(false);
    setAnimatedBoxes([]);
    try {
      const palletData = palletForm.getValues();
      const result = await runOptimization(boxes, {
        width: palletData.width,
        length: palletData.length,
        maxHeight: palletData.maxHeight,
      });
      setPlacedBoxes(result.placedBoxes);
      setUnplacedBoxes(result.unplacedBoxes);
      if (result.unplacedBoxes.length > 0) {
        toast({
          variant: "destructive",
          title: "Not all boxes could be placed",
          description: `${result.unplacedBoxes.length} box(es) could not fit on the pallet.`,
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Optimization Failed",
        description:
          error instanceof Error ? error.message : "An unknown error occurred.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const startAnimation = useCallback(() => {
    if (isAnimating || placedBoxes.length === 0) return;

    setActiveTab("visualizer");

    setTimeout(() => {
      setIsAnimating(true);
      setAnimatedBoxes([]);

      let step = 0;
      const interval = setInterval(() => {
        if (step < placedBoxes.length) {
          setAnimatedBoxes((prev) => [...prev, placedBoxes[step]]);
          step++;
        } else {
          clearInterval(interval);
          setIsAnimating(false);
        }
      }, 500);
    }, 100);
  }, [isAnimating, placedBoxes]);

  const clearAll = () => {
    setBoxes([]);
    setPlacedBoxes([]);
    setUnplacedBoxes([]);
    setAnimatedBoxes([]);
    setIsAnimating(false);
  };

  const boxesForVisualizer = isAnimating ? animatedBoxes : placedBoxes;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 p-4 md:p-8">
        <aside className="lg:col-span-4 xl:col-span-3 space-y-6">
          <PalletForm palletForm={palletForm} />
          <AddBoxForm boxForm={boxForm} addBox={addBox} />
          <BoxList
            boxes={boxes}
            removeBox={removeBox}
            clearAll={clearAll}
            handleOptimize={handleOptimize}
            isLoading={isLoading}
          />
        </aside>

        <main className="lg:col-span-8 xl:col-span-9">
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
                <TabsContent
                  value="visualizer"
                  className="flex-grow relative mt-0"
                >
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
                          <TableHead>Name</TableHead>
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
                                  {box.name}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-sm" />
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
        </main>
      </div>
    </div>
  );
}
