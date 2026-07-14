"use client";

import { Card, CardContent } from "@/components/ui/card";

interface KPI {
  title: string;
  value: string | number;
  subtitle?: string;
}

interface Props {
  items: KPI[];
}

export default function KPICards({ items }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Card key={item.title}>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">
              {item.title}
            </p>

            <h2 className="mt-2 text-3xl font-bold">
              {item.value}
            </h2>

            {item.subtitle && (
              <p className="mt-2 text-xs text-muted-foreground">
                {item.subtitle}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}