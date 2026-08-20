import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon, X } from "lucide-react";
import type { Matcher } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Calendar } from "@/components/ui/Calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover";

interface DatePickerProps {
  value?: string;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  className?: string;
  /** ISO 'YYYY-MM-DD'. Days strictly before this are disabled in the calendar. */
  minDate?: string;
  /** ISO 'YYYY-MM-DD'. Days strictly after this are disabled in the calendar. */
  maxDate?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Seleccionar fecha",
  className,
  minDate,
  maxDate,
}: DatePickerProps) {
  const date = value ? parseISO(value) : undefined;
  const disabledMatchers: Matcher[] = [
    ...(minDate ? [{ before: parseISO(minDate) }] : []),
    ...(maxDate ? [{ after: parseISO(maxDate) }] : []),
  ];

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {/*
        The wrapper's total width comes from the caller-supplied `className`
        (each page sizes it to fit its own longest expected date string).
        The trigger Button MUST fill that width via `flex-1 min-w-0` rather
        than carrying its own fixed width — a fixed inner width larger than
        the caller's wrapper used to force flexbox to shrink the button
        below its content size, overlapping the date text with the icon.
        `truncate` is a defensive fallback for any width still too tight.
      */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={"outline"}
            className={cn(
              "min-w-0 flex-1 justify-start gap-2 overflow-hidden text-left font-normal h-10 rounded-xl border-border/50 bg-background/50 hover:bg-muted/50 transition-all",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="h-4 w-4 shrink-0" />
            <span className="truncate">
              {date ? format(date, "PPP", { locale: es }) : placeholder}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(newDate) => {
              if (newDate) {
                // Format to YYYY-MM-DD
                const year = newDate.getFullYear();
                const month = String(newDate.getMonth() + 1).padStart(2, "0");
                const day = String(newDate.getDate()).padStart(2, "0");
                onChange(`${year}-${month}-${day}`);
              } else {
                onChange(undefined);
              }
            }}
            disabled={disabledMatchers.length ? disabledMatchers : undefined}
            initialFocus
            locale={es}
          />
        </PopoverContent>
      </Popover>
      {value && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-foreground"
          onClick={() => onChange(undefined)}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
