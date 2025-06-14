import React from 'react';
import { cn } from '@/lib/utils';

interface FormErrorProps extends React.HTMLAttributes<HTMLDivElement> {
  message?: string;
}

export function FormError({ message, className, ...props }: FormErrorProps) {
  if (!message) return null;

  return (
    <div
      className={cn('text-sm font-medium text-danger mt-1', className)}
      {...props}
    >
      {message}
    </div>
  );
} 