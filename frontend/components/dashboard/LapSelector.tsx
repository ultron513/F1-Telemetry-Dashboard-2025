"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  laps: number[];
  value: string;
  onChange: (value: string) => void;
}

export default function LapSelector({
  laps,
  value,
  onChange,
}: Props) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select Lap" />
      </SelectTrigger>

      <SelectContent>
        {laps.map((lap) => (
          <SelectItem
            key={lap}
            value={lap.toString()}
          >
            Lap {lap}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}