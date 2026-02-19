import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface CharLimitInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  multiline?: boolean;
  placeholder?: string;
  required?: boolean;
  className?: string;
  id?: string;
  rows?: number;
}

export function CharLimitInput({
  label,
  value,
  onChange,
  maxLength,
  multiline = false,
  placeholder,
  required = false,
  className = '',
  id,
  rows = 4,
}: CharLimitInputProps) {
  const remaining = maxLength - value.length;
  const isOverLimit = remaining < 0;
  const isNearLimit = remaining < 10 && remaining >= 0;

  const handleChange = (newValue: string) => {
    // Only enforce limit if maxLength > 0 (0 means no limit)
    if (maxLength > 0 && newValue.length > maxLength) {
      onChange(newValue.slice(0, maxLength));
    } else {
      onChange(newValue);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      {multiline ? (
        <Textarea
          id={id}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          className={isOverLimit ? 'border-red-500' : ''}
          rows={rows}
          required={required}
        />
      ) : (
        <Input
          id={id}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          className={isOverLimit ? 'border-red-500' : ''}
          required={required}
        />
      )}
      {maxLength > 0 && (
        <p className={`text-sm ${isOverLimit ? 'text-red-500' : isNearLimit ? 'text-yellow-500' : 'text-muted-foreground'}`}>
          {value.length}/{maxLength} characters
          {isNearLimit && !isOverLimit && (
            <span className="ml-2 font-semibold">({remaining} remaining)</span>
          )}
          {isOverLimit && (
            <span className="ml-2 font-semibold">(over limit by {Math.abs(remaining)})</span>
          )}
        </p>
      )}
    </div>
  );
}
