import React from 'react';
import { cn } from '@/lib/utils';

interface FormLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export function FormLabel({ required, className, children, ...props }: FormLabelProps) {
  return (
    <label
      className={cn('text-sm font-medium text-secondary-900 dark:text-secondary-50 block mb-2', className)}
      {...props}
    >
      {children}
      {required && <span className="text-danger ml-1">*</span>}
    </label>
  );
} 