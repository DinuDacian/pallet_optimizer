"use client";

export const Header = () => {
  return (
    <header className="py-6 px-4 md:px-8 border-b border-border">
      <h1 className="text-3xl font-bold text-primary tracking-tight">
        Pallet Optimizer
      </h1>
      <p className="text-muted-foreground mt-1">
        Efficiently pack your boxes onto a pallet with 3D visualization.
      </p>
    </header>
  );
};
