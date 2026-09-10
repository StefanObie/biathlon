"use client";

import { useMemo, useState } from "react";
import { ChevronsUpDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface AthleteOption {
  athleteNo: number;
  fullName: string;
}

/**
 * Athlete number or name search (§4.5's "reassign athlete by number or name
 * search"). Searches the whole league roster, not just this heat's — an
 * athlete can be reassigned in from wherever they actually ran.
 */
export function AthleteCombobox({
  options,
  value,
  onSelect,
}: {
  options: AthleteOption[];
  value: AthleteOption | null;
  onSelect: (athlete: AthleteOption) => void;
}) {
  const [open, setOpen] = useState(false);

  const sorted = useMemo(
    () => [...options].sort((a, b) => a.athleteNo - b.athleteNo),
    [options],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-8 w-full justify-between px-2 font-normal"
        >
          <span className="truncate">
            {value ? `${value.athleteNo} ${value.fullName}` : "—"}
          </span>
          <ChevronsUpDownIcon className="ml-1 size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0">
        <Command
          filter={(itemValue, search) =>
            itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
          }
        >
          <CommandInput placeholder="Athlete number or name…" />
          <CommandList>
            <CommandEmpty>No athlete found.</CommandEmpty>
            <CommandGroup>
              {sorted.map((athlete) => (
                <CommandItem
                  key={athlete.athleteNo}
                  value={`${athlete.athleteNo} ${athlete.fullName}`}
                  onSelect={() => {
                    onSelect(athlete);
                    setOpen(false);
                  }}
                  className={cn(
                    value?.athleteNo === athlete.athleteNo && "bg-accent",
                  )}
                >
                  {athlete.athleteNo} {athlete.fullName}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
