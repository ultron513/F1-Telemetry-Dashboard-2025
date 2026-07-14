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

export default function DriverSelector({
  drivers,
  value,
  onChange,
}: Props) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[220px]">
        <SelectValue placeholder="Select Driver" />
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