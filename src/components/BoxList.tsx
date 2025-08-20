"use client";

import { Box } from "@/lib/types";
import { Trash2, Sparkles, RotateCw, BoxIcon, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface BoxListProps {
  boxes: Box[];
  removeBox: (id: string) => void;
  handleOptimize: () => Promise<void>;
  clearAll: () => void;
  isLoading: boolean;
}

export function BoxList({
  boxes,
  removeBox,
  handleOptimize,
  clearAll,
  isLoading,
}: BoxListProps) {
  console.log(boxes);
  return (
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
              <p className="text-muted-foreground text-center py-8">
                No boxes added yet.
              </p>
            ) : (
              boxes.map((box) => (
                <div
                  key={box.id}
                  className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
                >
                  <div
                    style={{ backgroundColor: box.color }}
                    className="w-4 h-4 rounded-sm shrink-0 mr-2"
                  ></div>
                  <div className="text-sm flex-1">
                    <p className="font-medium">{box.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {box.length} x {box.width} x {box.height} cm ||{" "}
                      {box.weight} kg
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => removeBox(box.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
        <Separator className="my-4" />
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            onClick={handleOptimize}
            disabled={boxes.length === 0 || isLoading}
            className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
          >
            {isLoading ? <Loader2 className="animate-spin" /> : <Sparkles />}
            Optimize
          </Button>
          <Button onClick={clearAll} variant="outline" className="w-full">
            <RotateCw /> Clear All
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
