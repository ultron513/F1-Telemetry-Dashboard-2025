"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Driver {
  code: string;
  full_name: string;
  team: string;
}

interface Props {
  drivers: Driver[];
  value: string;
  onChange: (value: string) => void;
}

export default function CompareDriverSelector({
  drivers,
  value,
  onChange,
}: Props) {
  return (
    <Select value={value} onValueChange={(v)=>{console.log("Selected:", v); onChange(v)}}>
      <SelectTrigger className="w-[220px]">
        <SelectValue placeholder="Compare Driver" />
      </SelectTrigger>

      <SelectContent>
        {drivers.map((driver) => (
          <SelectItem
            key={driver.code}
            value={driver.code}
          >
            {driver.code} - {driver.full_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}