import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={cn('card', className)}>{children}</section>;
}
