"use client";

import { useForm, type SubmitHandler, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PackagePlus } from 'lucide-react';
import { z } from 'zod'; // Import z from zod

import { Button } from '@/components/ui/button';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export const boxSchema = z.object({
  length: z.coerce.number().positive({ message: 'Must be > 0' }).max(120),
  width: z.coerce.number().positive({ message: 'Must be > 0' }).max(80),
  height: z.coerce.number().positive({ message: 'Must be > 0' }).max(200),
  weight: z.coerce.number().positive({ message: 'Must be > 0' }),
});

export type BoxFormData = z.infer<typeof boxSchema>;

// Although not used within the component, the randomHexColor function is tightly coupled
// with the process of creating a new box, which is managed via addBox handler.
// Keeping it here makes the component self-contained for box creation logic.
const randomHexColor = () => `#${Math.floor(Math.random()*16777215).toString(16).padEnd(6, '0')}`;

interface AddBoxFormProps {
  boxForm: UseFormReturn<BoxFormData>;
  addBox: SubmitHandler<BoxFormData>;
}
export function AddBoxForm({ boxForm, addBox }: AddBoxFormProps) {
  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PackagePlus />
          Add a Box
        </CardTitle>
        <CardDescription>Enter dimensions (cm) and weight (kg).</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={boxForm.handleSubmit(addBox)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="length">Length</Label>
              <Input id="length" type="number" {...boxForm.register('length')} />
              {boxForm.formState.errors.length && <p className="text-destructive text-xs mt-1">{boxForm.formState.errors.length.message}</p>}
            </div>
            <div>
              <Label htmlFor="width">Width</Label>
              <Input id="width" type="number" {...boxForm.register('width')} />
              {boxForm.formState.errors.width && <p className="text-destructive text-xs mt-1">{boxForm.formState.errors.width.message}</p>}
            </div>
            <div>
              <Label htmlFor="height">Height</Label>
              <Input id="height" type="number" {...boxForm.register('height')} />
              {boxForm.formState.errors.height && <p className="text-destructive text-xs mt-1">{boxForm.formState.errors.height.message}</p>}
            </div>
            <div>
              <Label htmlFor="weight">Weight</Label>
              <Input id="weight" type="number" {...boxForm.register('weight')} />
              {boxForm.formState.errors.weight && <p className="text-destructive text-xs mt-1">{boxForm.formState.errors.weight.message}</p>}
            </div>
          </div>
            <Button
            type="submit"
            className="w-full bg-primary hover:bg-primary/90"
            disabled={boxForm.formState.isSubmitting}
            onClick={() => {
              setTimeout(() => {
              boxForm.setValue('length', boxForm.getValues('length')); // trigger rerender
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