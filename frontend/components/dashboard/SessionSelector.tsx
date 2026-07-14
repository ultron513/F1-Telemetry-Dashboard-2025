"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Session {
  name: string;
}

interface Props {
  sessions: Session[];
  value: string;
  onChange: (value: string) => void;
}

export default function SessionSelector({
  sessions,
  value,
  onChange,
}: Props) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[220px]">
        <SelectValue placeholder="Select Session" />
      </SelectTrigger>

      <SelectContent>
        {sessions.map((session) => (
          <SelectItem
            key={session.name}
            value={session.name}
          >
            {session.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}