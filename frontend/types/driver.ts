export interface Driver {
  driver: string;
  driver_number: string;
  full_name?: string;
  team?: string;
}

export interface Team {
  team: string;
  drivers?: string[];
}