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
      <Label>
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      {multiline ? (
        <Textarea
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          className={isOverLimit ? 'border-red-500' : ''}
          rows={4}
        />
      ) : (
        <Input
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          className={isOverLimit ? 'border-red-500' : ''}
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
