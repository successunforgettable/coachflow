import { useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { DateRange, DayPicker } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import "react-day-picker/dist/style.css";

interface DateRangePickerProps {
  value?: { since?: string; until?: string };
  onChange: (range: { since?: string; until?: string } | undefined) => void;
  className?: string;
}

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  
  // Convert string dates to Date objects for DayPicker
  const dateRange: DateRange | undefined = value?.since && value?.until
    ? {
        from: new Date(value.since),
        to: new Date(value.until),
      }
    : undefined;

  const handleSelect = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      onChange({
        since: format(range.from, "yyyy-MM-dd"),
        until: format(range.to, "yyyy-MM-dd"),
      });
    } else {
      onChange(undefined);
    }
  };

  const handlePreset = (days: number) => {
    const until = new Date();
    const since = new Date();
    since.setDate(since.getDate() - days);
    
    onChange({
      since: format(since, "yyyy-MM-dd"),
      until: format(until, "yyyy-MM-dd"),
    });
    setOpen(false);
  };

  const handleAllTime = () => {
    onChange(undefined);
    setOpen(false);
  };

  const displayText = dateRange?.from && dateRange?.to
    ? `${format(dateRange.from, "MMM d, yyyy")} - ${format(dateRange.to, "MMM d, yyyy")}`
    : value === undefined
    ? "All time"
    : "Select date range";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-[280px] justify-start text-left font-normal",
              !dateRange && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {displayText}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <div className="flex">
            {/* Preset buttons */}
            <div className="flex flex-col gap-1 p-3 border-r">
              <Button
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={() => handlePreset(7)}
              >
                Last 7 days
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={() => handlePreset(30)}
              >
                Last 30 days
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={() => handlePreset(90)}
              >
                Last 90 days
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={handleAllTime}
              >
                All time
              </Button>
            </div>
            
            {/* Calendar */}
            <div className="p-3">
              <DayPicker
                mode="range"
                selected={dateRange}
                onSelect={handleSelect}
                numberOfMonths={2}
                disabled={{ after: new Date() }}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
