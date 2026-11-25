"use client";

import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { shiftMonth } from "@/domain/calculations";
import { Button } from "@/components/ui/button";

export function monthLabel(month: string): string {
  const [year, number] = month.split("-").map(Number);
  return format(new Date(year ?? 1970, (number ?? 1) - 1, 1), "MMMM yyyy");
}

export function MonthNav({
  month,
  onChange,
}: {
  month: string;
  onChange: (month: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        className="size-8"
        aria-label="Previous month"
        onClick={() => onChange(shiftMonth(month, -1))}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <span className="min-w-[9rem] text-center text-sm font-semibold tabular">
        {monthLabel(month)}
      </span>
      <Button
        variant="outline"
        size="icon"
        className="size-8"
        aria-label="Next month"
        onClick={() => onChange(shiftMonth(month, 1))}
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
