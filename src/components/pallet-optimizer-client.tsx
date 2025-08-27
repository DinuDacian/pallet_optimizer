
"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import React from 'react';
import { runOptimization } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import type { Box, PlacedBox, PalletLoad } from '@/lib/types';
import { PALLET_WIDTH, PALLET_LENGTH, PALLET_MAX_LOAD_HEIGHT, PALLET_MAX_WEIGHT } from '@/lib/types';
import { PalletForm, PalletFormData, palletSchema } from './PalletForm';
import { AddBoxForm, BoxFormData, boxSchema } from './AddBoxForm';
import { Button } from '@/components/ui/button';
import { PalletVisualizer } from './pallet-visualizer';
import { TableHeader, TableRow, TableHead, TableBody, TableCell, Table } from './ui/table';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { BoxIcon, Trash2, Loader2, Sparkles, RotateCw, Play, Weight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';

export function PalletOptimizerClient() {
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [palletLoads, setPalletLoads] = useState<PalletLoad[]>([]);
  const [unplacedBoxes, setUnplacedBoxes] = useState<Box[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hoveredBoxId, setHoveredBoxId] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animatedBoxes, setAnimatedBoxes] = useState<PlacedBox[]>([]);
  const [activeTab, setActiveTab] = useState('visualizer');
  const { toast } = useToast();
  const optimizationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isOptimizationRunning = useRef(false);


  const boxForm = useForm<BoxFormData>({
    resolver: zodResolver(boxSchema),
    defaultValues: {
      length: 40,
      width: 30,
      height: 20,
      weight: 10,
    },
  });

  const randomHexColor = () => `#${Math.floor(Math.random()*16777215).toString(16).padEnd(6, '0')}`;

  const palletForm = useForm<PalletFormData>({
      resolver: zodResolver(palletSchema),
      defaultValues: {
          width: PALLET_WIDTH,
          length: PALLET_LENGTH,
          maxHeight: PALLET_MAX_LOAD_HEIGHT,
          maxWeight: PALLET_MAX_WEIGHT
      }
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

  const allPlacedBoxes = palletLoads.flatMap(p => p.placedBoxes);

  const handleOptimize = useCallback(async () => {
    if (isOptimizationRunning.current) return;
    isOptimizationRunning.current = true;

    setIsLoading(true);
    setPalletLoads([]);
    setUnplacedBoxes([]);
    setIsAnimating(false);
    setAnimatedBoxes([]);
    try {
      const palletData = palletForm.getValues();
      const result = await runOptimization(boxes, {
        width: palletData.width,
        length: palletData.length,
        maxHeight: palletData.maxHeight,
        maxWeight: palletData.maxWeight
      });
      setPalletLoads(result.palletLoads);
      setUnplacedBoxes(result.unplacedBoxes);
      if (result.unplacedBoxes.length > 0) {
        toast({
            variant: "destructive",
            title: "Not all boxes could be placed",
            description: `${result.unplacedBoxes.length} box(es) could not fit on the pallet(s).`,
        });
      }
    } catch (error) {
       toast({
        variant: "destructive",
        title: "Optimization Failed",
        description: error instanceof Error ? error.message : "An unknown error occurred.",
      });
    } finally {
      setIsLoading(false);
      isOptimizationRunning.current = false;
    }
  }, [boxes, palletForm, toast]);
  
  const debouncedOptimize = useCallback(() => {
    // This function acts like a fresh "Optimize" click.
    // It clears previous results and runs a full new optimization.
    setPalletLoads([]);
    setUnplacedBoxes([]);
    setAnimatedBoxes([]);
    setIsAnimating(false);
    setIsLoading(true); // Show loading state immediately

    if (optimizationTimeoutRef.current) {
      clearTimeout(optimizationTimeoutRef.current);
    }
    
    optimizationTimeoutRef.current = setTimeout(() => {
        // Only run if there are boxes to optimize
        if (boxes.length > 0) {
            handleOptimize();
        } else {
            setIsLoading(false); // No boxes, so stop loading
        }
    }, 500);
  }, [handleOptimize, boxes.length]);


  const startAnimation = useCallback(() => {
    if (isAnimating || allPlacedBoxes.length === 0) return;

    setActiveTab('visualizer');
    
    setTimeout(() => {
        setIsAnimating(true);
        setAnimatedBoxes([]);
        
        let step = 0;
        const interval = setInterval(() => {
          if (step < allPlacedBoxes.length) {
            setAnimatedBoxes(prev => [...prev, allPlacedBoxes[step]]);
            step++;
          } else {
            clearInterval(interval);
            setIsAnimating(false);
          }
        }, 500);
    }, 100);

  }, [isAnimating, allPlacedBoxes]);

  const clearAll = () => {
    setBoxes([]);
    setPalletLoads([]);
    setUnplacedBoxes([]);
    setAnimatedBoxes([]);
    setIsAnimating(false);
  }

  const boxesForVisualizer = isAnimating ? animatedBoxes : allPlacedBoxes;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="py-6 px-4 md:px-8 border-b border-border">
        <h1 className="text-3xl font-bold text-primary tracking-tight">Pallet Optimizer</h1>
        <p className="text-muted-foreground mt-1">Efficiently pack your boxes onto multiple pallets with 3D visualization.</p>
      </header>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 p-4 md:p-8">
        <aside className="lg:col-span-4 xl:col-span-3 space-y-6">
          <PalletForm palletForm={palletForm} onDimensionsChange={debouncedOptimize} />
          <AddBoxForm boxForm={boxForm} addBox={addBox} />

          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BoxIcon />
                Box List ({boxes.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-48 pr-3">
                <div className="space-y-3">
                  {boxes.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No boxes added yet.</p>
                  ) : (
                    boxes.map((box) => (
                      <div key={box.id} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div style={{ backgroundColor: box.color }} className="w-4 h-4 rounded-sm shrink-0"></div>
                          <div className="text-sm">
                            <p className="font-medium">{box.length} x {box.width} x {box.height} cm</p>
                            <p className="text-xs text-muted-foreground">{box.weight} kg</p>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeBox(box.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
               <Separator className="my-4" />
                <div className="flex flex-col sm:flex-row gap-2">
                    <Button onClick={handleOptimize} disabled={boxes.length === 0 || isLoading} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                        {isLoading ? <Loader2 className="animate-spin" /> : <Sparkles />}
                        Optimize
                    </Button>
                    <Button onClick={clearAll} variant="outline" className="w-full">
                        <RotateCw /> Clear All
                    </Button>
                </div>
            </CardContent>
          </Card>
        </aside>

        <main className="lg:col-span-8 xl:col-span-9">
          <Card className="shadow-lg h-full min-h-[80vh]">
            <CardContent className="p-0 h-full">
                <Tabs defaultValue="visualizer" value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                    <TabsList className="m-2">
                        <TabsTrigger value="visualizer">3D Visualization</TabsTrigger>
                        <TabsTrigger value="guide">Placement Guide</TabsTrigger>
                    </TabsList>
                    <Separator/>
                    <TabsContent value="visualizer" className="flex-grow relative mt-0">
                        <PalletVisualizer 
                          placedBoxes={boxesForVisualizer} 
                          hoveredBoxId={hoveredBoxId} 
                          setHoveredBoxId={setHoveredBoxId} 
                          isLoading={isLoading}
                          palletDimensions={palletDimensions}
                          palletCount={palletLoads.length || 1}
                        />
                    </TabsContent>
                    <TabsContent value="guide" className="flex-grow relative mt-0 flex flex-col">
                        <div className="p-2">
                          <Button onClick={startAnimation} disabled={isAnimating || allPlacedBoxes.length === 0}>
                            <Play className="mr-2 h-4 w-4" />
                            {isAnimating ? 'Animating...' : 'Start Animation'}
                          </Button>
                        </div>
                        <ScrollArea className="h-[calc(80vh-80px)]">
                            <div className="flex justify-end mb-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const header = ['Pallet', 'Step', 'Box Dimensions', 'Weight', 'Position (x, y, z)'];
                                  const rows: (string | number)[][] = [];

                                  palletLoads.forEach((load) => {
                                    // Add a row for the pallet header
                                    rows.push([
                                      `Pallet #${load.palletIndex + 1} (Total Weight: ${load.totalWeight.toFixed(1)} kg)`,
                                      '', '', '', ''
                                    ]);
                                    // Add rows for each placed box
                                    load.placedBoxes.forEach((box, idx) => {
                                      rows.push([
                                        box.palletIndex + 1,
                                        idx + 1,
                                        `${box.length} x ${box.width} x ${box.height} cm`,
                                        `${box.weight} kg`,
                                        `${box.x.toFixed(1)}, ${box.y.toFixed(1)}, ${box.z.toFixed(1)}`
                                      ]);
                                    });
                                  });

                                  if (unplacedBoxes.length > 0) {
                                    rows.push(['Unplaced Boxes', '', '', '', '']);
                                    unplacedBoxes.forEach((box) => {
                                      rows.push([
                                        '-',
                                        '-',
                                        `${box.length} x ${box.width} x ${box.height} cm`,
                                        `${box.weight} kg`,
                                        'Could not be placed'
                                      ]);
                                    });
                                  }

                                  const csvContent =
                                    [header, ...rows]
                                      .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
                                      .join('\r\n');
                                  const blob = new Blob([csvContent], { type: 'text/csv' });
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = `pallet_optimization_all.csv`;
                                  document.body.appendChild(a);
                                  a.click();
                                  setTimeout(() => {
                                    document.body.removeChild(a);
                                    URL.revokeObjectURL(url);
                                  }, 0);
                                }}
                                disabled={palletLoads.length === 0 && unplacedBoxes.length === 0}
                              >
                                Export All as CSV
                              </Button>
                            </div>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Pallet</TableHead>
                                  <TableHead className="w-[80px]">Step</TableHead>
                                  <TableHead>Box Dimensions</TableHead>
                                  <TableHead><Weight className="inline-block w-4 h-4" /> Weight</TableHead>
                                  <TableHead>Position (x, y, z)</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {palletLoads.length > 0 ? palletLoads.map((load) => (
                                  <React.Fragment key={load.palletIndex}>
                                    <TableRow>
                                      <TableCell colSpan={5} className="font-bold bg-secondary flex items-center justify-between">
                                        <span>
                                          Pallet #{load.palletIndex + 1} (Total Weight: {load.totalWeight.toFixed(1)} kg)
                                        </span>
                                        {/* Export CSV button for this pallet */}
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            const header = ['Step', 'Box Dimensions', 'Weight', 'Position (x, y, z)'];
                                            const rows = load.placedBoxes.map((box, idx) => [
                                              idx + 1,
                                              `${box.length} x ${box.width} x ${box.height} cm`,
                                              `${box.weight} kg`,
                                              `${box.x.toFixed(1)}, ${box.y.toFixed(1)}, ${box.z.toFixed(1)}`
                                            ]);
                                            const csvContent =
                                              [header, ...rows]
                                                .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
                                                .join('\r\n');
                                            const blob = new Blob([csvContent], { type: 'text/csv' });
                                            const url = URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.download = `pallet_${load.palletIndex + 1}.csv`;
                                            document.body.appendChild(a);
                                            a.click();
                                            setTimeout(() => {
                                              document.body.removeChild(a);
                                              URL.revokeObjectURL(url);
                                            }, 0);
                                          }}
                                        >
                                          Export CSV
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                    {load.placedBoxes.map((box, index) => (
                                      <TableRow 
                                          key={box.id}
                                          onMouseEnter={() => setHoveredBoxId(box.id)}
                                          onMouseLeave={() => setHoveredBoxId(null)}
                                          className="cursor-pointer"
                                      >
                                          <TableCell>{box.palletIndex + 1}</TableCell>
                                          <TableCell className="font-medium">{index + 1}</TableCell>
                                          <TableCell>
                                              <div className="flex items-center gap-2">
                                                  <div style={{backgroundColor: box.color}} className="w-3 h-3 rounded-sm"/>
                                                  {box.length} x {box.width} x {box.height} cm
                                              </div>
                                          </TableCell>
                                          <TableCell>{box.weight} kg</TableCell>
                                          <TableCell>{`${box.x.toFixed(1)}, ${box.y.toFixed(1)}, ${box.z.toFixed(1)}`}</TableCell>
                                      </TableRow>
                                    ))}
                                  </React.Fragment>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-48 text-center text-muted-foreground">
                                            {isLoading ? 'Optimizing layout...' : 'No optimized layout to show. Add boxes and click "Optimize".'}
                                        </TableCell>
                                    </TableRow>
                                )}
                                {unplacedBoxes.length > 0 && (
                                    <>
                                        <TableRow>
                                            <TableCell colSpan={5} className="font-bold text-destructive bg-destructive/10">Unplaced Boxes</TableCell>
                                        </TableRow>
                                        {unplacedBoxes.map((box) => (
                                            <TableRow key={box.id} className="bg-destructive/10 text-destructive-foreground">
                                                <TableCell>-</TableCell>
                                                <TableCell className="font-medium">-</TableCell>
                                                <TableCell>{box.length} x {box.width} x {box.height} cm</TableCell>
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

    