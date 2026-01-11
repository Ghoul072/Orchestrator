import { describe, it, expect } from 'vitest'
import { cn } from '~/lib/utils'

describe('Utility Functions', () => {
  describe('cn (className merger)', () => {
    it('should merge class names', () => {
      const result = cn('foo', 'bar')
      expect(result).toBe('foo bar')
    })

    it('should handle conditional classes', () => {
      const isActive = true
      const isDisabled = false

      const result = cn(
        'base-class',
        isActive && 'active',
        isDisabled && 'disabled'
      )

      expect(result).toBe('base-class active')
    })

    it('should handle undefined and null values', () => {
      const result = cn('foo', undefined, null, 'bar')
      expect(result).toBe('foo bar')
    })

    it('should handle empty strings', () => {
      const result = cn('foo', '', 'bar')
      expect(result).toBe('foo bar')
    })

    it('should handle tailwind class conflicts', () => {
      const result = cn('px-4', 'px-6')
      expect(result).toBe('px-6')
    })

    it('should preserve non-conflicting classes', () => {
      const result = cn('px-4 py-2', 'mx-auto')
      expect(result).toBe('px-4 py-2 mx-auto')
    })

    it('should handle object syntax', () => {
      const result = cn({
        'base-class': true,
        'active-class': true,
        'disabled-class': false,
      })

      expect(result).toBe('base-class active-class')
    })

    it('should handle array syntax', () => {
      const result = cn(['foo', 'bar'], 'baz')
      expect(result).toBe('foo bar baz')
    })

    it('should handle complex tailwind conflicts', () => {
      const result = cn(
        'bg-red-500 text-white',
        'bg-blue-500'
      )
      expect(result).toBe('text-white bg-blue-500')
    })

    it('should handle hover and focus variants', () => {
      const result = cn(
        'hover:bg-red-500',
        'hover:bg-blue-500'
      )
      expect(result).toBe('hover:bg-blue-500')
    })

    it('should handle dark mode variants', () => {
      const result = cn(
        'dark:bg-gray-800',
        'bg-white'
      )
      expect(result).toBe('dark:bg-gray-800 bg-white')
    })

    it('should handle responsive variants', () => {
      const result = cn(
        'sm:px-4',
        'md:px-6',
        'lg:px-8'
      )
      expect(result).toBe('sm:px-4 md:px-6 lg:px-8')
    })
  })
})

describe('Type Guards and Validators', () => {
  describe('UUID validation', () => {
    const isValidUUID = (str: string): boolean => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      return uuidRegex.test(str)
    }

    it('should validate standard UUIDs', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
      expect(isValidUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true)
    })

    it('should reject invalid UUIDs', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false)
      expect(isValidUUID('550e8400-e29b-41d4-a716')).toBe(false)
      expect(isValidUUID('')).toBe(false)
      expect(isValidUUID('550e8400e29b41d4a716446655440000')).toBe(false)
    })
  })

  describe('Date string validation', () => {
    const isValidISODate = (str: string): boolean => {
      const date = new Date(str)
      return !isNaN(date.getTime())
    }

    it('should validate ISO date strings', () => {
      expect(isValidISODate('2024-01-15')).toBe(true)
      expect(isValidISODate('2024-01-15T10:30:00Z')).toBe(true)
      expect(isValidISODate('2024-01-15T10:30:00.000Z')).toBe(true)
    })

    it('should reject invalid date strings', () => {
      expect(isValidISODate('not-a-date')).toBe(false)
      expect(isValidISODate('2024-13-45')).toBe(false)
      expect(isValidISODate('')).toBe(false)
    })
  })
})
