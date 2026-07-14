"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Race {
  round_number: number;
  event_name: string;
  country: string;
  location: string;
}

interface Props {
  races: Race[];
  value: string;
  onChange: (value: string) => void;
}

export default function EventSelector({
  races,
  value,
  onChange,
}: Props) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[280px]">
        <SelectValue placeholder="Select Event" />
      </SelectTrigger>

      <SelectContent>
        {races.map((race) => (
          <SelectItem
            key={race.event_name}
            value={race.event_name}
          >
            {race.event_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}