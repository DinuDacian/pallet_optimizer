"use client";

import { UseFormReturn } from 'react-hook-form';
import { z } from 'zod';

import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Archive } from 'lucide-react';

export const palletSchema = z.object({
  width: z.coerce.number().positive({ message: 'Must be > 0' }),
  length: z.coerce.number().positive({ message: 'Must be > 0' }),
  maxHeight: z.coerce.number().positive({ message: 'Must be > 0' }),
});

export type PalletFormData = z.infer<typeof palletSchema>;

interface PalletFormProps {
  palletForm: UseFormReturn<PalletFormData>;
}

export function PalletForm({ palletForm }: PalletFormProps) {
  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Archive />
          Pallet Dimensions
        </CardTitle>
        <CardDescription>Enter pallet dimensions (cm).</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}> {/* Prevent default form submission */}
           <div className="grid grid-cols-2 gap-4">
              <div>
                  <Label htmlFor="palletLength">Length</Label>
                  <Input id="palletLength" type="number" {...palletForm.register('length')} />
                  {palletForm.formState.errors.length && <p className="text-destructive text-xs mt-1">{palletForm.formState.errors.length.message}</p>}
              </div>
              <div>
                  <Label htmlFor="palletWidth">Width</Label>
                  <Input id="palletWidth" type="number" {...palletForm.register('width')} />
                  {palletForm.formState.errors.width && <p className="text-destructive text-xs mt-1">{palletForm.formState.errors.width.message}</p>}
              </div>
              <div className="col-span-2">
                  <Label htmlFor="palletMaxHeight">Max Load Height</Label>
                  <Input id="palletMaxHeight" type="number" {...palletForm.register('maxHeight')} />
                  {palletForm.formState.errors.maxHeight && <p className="text-destructive text-xs mt-1">{palletForm.formState.errors.maxHeight.message}</p>}
              </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}