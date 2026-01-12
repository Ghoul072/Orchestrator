'use client'

import { cn } from '~/lib/utils'

export interface LoaderProps {
  variant?: 'circular' | 'typing' | 'dots'
  size?: 'sm' | 'md' | 'lg'
  text?: string
  className?: string
}

export function CircularLoader({
  className,
  size = 'md',
}: {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizeClasses = {
    sm: 'size-4',
    md: 'size-5',
    lg: 'size-6',
  }

  return (
    <div
      className={cn(
        'border-primary animate-spin rounded-full border-2 border-t-transparent',
        sizeClasses[size],
        className
      )}
    >
      <span className="sr-only">Loading</span>
    </div>
  )
}

export function TypingLoader({
  className,
  size = 'md',
}: {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const dotSizes = {
    sm: 'h-1 w-1',
    md: 'h-1.5 w-1.5',
    lg: 'h-2 w-2',
  }

  const containerSizes = {
    sm: 'h-4',
    md: 'h-5',
    lg: 'h-6',
  }

  return (
    <div
      className={cn(
        'flex items-center space-x-1',
        containerSizes[size],
        className
      )}
    >
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className={cn(
            'bg-primary rounded-full animate-bounce',
            dotSizes[size]
          )}
          style={{
            animationDelay: `${i * 150}ms`,
            animationDuration: '600ms',
          }}
        />
      ))}
      <span className="sr-only">Loading</span>
    </div>
  )
}

export function DotsLoader({
  className,
  size = 'md',
}: {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const dotSizes = {
    sm: 'h-1.5 w-1.5',
    md: 'h-2 w-2',
    lg: 'h-2.5 w-2.5',
  }

  const containerSizes = {
    sm: 'h-4',
    md: 'h-5',
    lg: 'h-6',
  }

  return (
    <div
      className={cn(
        'flex items-center space-x-1',
        containerSizes[size],
        className
      )}
    >
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className={cn(
            'bg-primary rounded-full animate-pulse',
            dotSizes[size]
          )}
          style={{
            animationDelay: `${i * 200}ms`,
          }}
        />
      ))}
      <span className="sr-only">Loading</span>
    </div>
  )
}

export function Loader({
  variant = 'circular',
  size = 'md',
  className,
}: LoaderProps) {
  switch (variant) {
    case 'circular':
      return <CircularLoader size={size} className={className} />
    case 'typing':
      return <TypingLoader size={size} className={className} />
    case 'dots':
      return <DotsLoader size={size} className={className} />
    default:
      return <CircularLoader size={size} className={className} />
  }
}
