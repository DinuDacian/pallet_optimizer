"use client";

import { useForm, type SubmitHandler, UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PackagePlus } from "lucide-react";
import { z } from "zod";
import Papa from "papaparse";

import { Button } from "@/components/ui/button";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const boxSchema = z.object({
  length: z.coerce.number().positive({ message: "Must be > 0" }).max(120),
  width: z.coerce.number().positive({ message: "Must be > 0" }).max(80),
  height: z.coerce.number().positive({ message: "Must be > 0" }).max(200),
  weight: z.coerce.number().positive({ message: "Must be > 0" }),
  name: z.string().min(1, { message: "Name is required" }),
});

export type BoxFormData = z.infer<typeof boxSchema>;

interface AddBoxFormProps {
  boxForm: UseFormReturn<BoxFormData>;
  addBox: SubmitHandler<BoxFormData>;
}

export function AddBoxForm({ boxForm, addBox }: AddBoxFormProps) {
  const handleCSVUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as Array<Record<string, string>>;
        if (data.length === 0) {
          alert("CSV file is empty.");
          return;
        }
        // Add each box from CSV
        data.forEach((row) => {
          try {
            const box: BoxFormData = {
              name: row.name || "",
              length: Number(row.length),
              width: Number(row.width),
              height: Number(row.height),
              weight: Number(row.weight),
            };
            // Validate using schema before adding
            const parsed = boxSchema.safeParse(box);
            if (parsed.success) {
              addBox(box);
            }
          } catch (error) {
            // skip invalid row
          }
        });
        // After all boxes are added, run optimize
        if (typeof (window as any).optimize === "function") {
          (window as any).optimize();
        }
      },
      error: () => {
        alert("Failed to parse CSV file.");
      },
    });
  };

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PackagePlus />
          Add a Box
        </CardTitle>
        <CardDescription>
          Enter dimensions (cm) and weight (kg).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={boxForm.handleSubmit(addBox)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <Label htmlFor="name">Name or Bar Code</Label>
            <Input id="name" type="text" {...boxForm.register("name")} />
            {boxForm.formState.errors.name && (
              <p className="text-destructive text-xs mt-1">
                {boxForm.formState.errors.name.message}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="length">Length</Label>
              <Input
                id="length"
                type="number"
                {...boxForm.register("length")}
              />
              {boxForm.formState.errors.length && (
                <p className="text-destructive text-xs mt-1">
                  {boxForm.formState.errors.length.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="width">Width</Label>
              <Input id="width" type="number" {...boxForm.register("width")} />
              {boxForm.formState.errors.width && (
                <p className="text-destructive text-xs mt-1">
                  {boxForm.formState.errors.width.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="height">Height</Label>
              <Input
                id="height"
                type="number"
                {...boxForm.register("height")}
              />
              {boxForm.formState.errors.height && (
                <p className="text-destructive text-xs mt-1">
                  {boxForm.formState.errors.height.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="weight">Weight</Label>
              <Input
                id="weight"
                type="number"
                {...boxForm.register("weight")}
              />
              {boxForm.formState.errors.weight && (
                <p className="text-destructive text-xs mt-1">
                  {boxForm.formState.errors.weight.message}
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <Label htmlFor="csvUpload">Upload CSV</Label>
            <Input
              id="csvUpload"
              type="file"
              accept=".csv"
              onChange={handleCSVUpload}
            />
          </div>
          <Button
            type="submit"
            className="w-full bg-primary hover:bg-primary/90"
            disabled={boxForm.formState.isSubmitting}
            onClick={() => {
              setTimeout(() => {
                boxForm.setValue("length", boxForm.getValues("length")); // trigger rerender
              }, 1000);
            }}
          >
            <PackagePlus className="mr-2 h-4 w-4" />
            Add Box
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
