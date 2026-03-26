import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn (class name utility)', () => {
  describe('basic usage', () => {
    it('returns a single class unchanged', () => {
      expect(cn('text-sm')).toBe('text-sm');
    });

    it('joins multiple non-conflicting classes', () => {
      expect(cn('text-sm', 'font-bold')).toBe('text-sm font-bold');
    });

    it('joins multiple classes into a single space-separated string', () => {
      expect(cn('px-4', 'py-2', 'rounded')).toBe('px-4 py-2 rounded');
    });

    it('returns an empty string when called with no arguments', () => {
      expect(cn()).toBe('');
    });
  });

  describe('conflicting Tailwind class merging', () => {
    it('last background color wins when two bg- classes conflict', () => {
      expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500');
    });

    it('last text color wins when two text-color classes conflict', () => {
      expect(cn('text-red-500', 'text-green-700')).toBe('text-green-700');
    });

    it('last padding wins when two p- classes conflict', () => {
      expect(cn('p-4', 'p-8')).toBe('p-8');
    });

    it('last padding-x wins when two px- classes conflict', () => {
      expect(cn('px-2', 'px-6')).toBe('px-6');
    });

    it('merges conflicting classes from mixed inputs correctly', () => {
      // p-4 sets padding on all sides; px-2 overrides just the horizontal axis
      const result = cn('p-4', 'px-2');
      expect(result).toBe('p-4 px-2');
    });

    it('last font-size wins when two text-size classes conflict', () => {
      expect(cn('text-sm', 'text-lg')).toBe('text-lg');
    });

    it('merges border-radius conflicts', () => {
      expect(cn('rounded', 'rounded-full')).toBe('rounded-full');
    });
  });

  describe('conditional / falsy values', () => {
    it('ignores false', () => {
      expect(cn('text-sm', false)).toBe('text-sm');
    });

    it('ignores undefined', () => {
      expect(cn('text-sm', undefined)).toBe('text-sm');
    });

    it('ignores null', () => {
      expect(cn('text-sm', null)).toBe('text-sm');
    });

    it('ignores empty string', () => {
      expect(cn('text-sm', '')).toBe('text-sm');
    });

    it('handles conditional expression that evaluates to false', () => {
      const isActive = false;
      expect(cn('btn', isActive && 'btn-active')).toBe('btn');
    });

    it('includes the class when conditional expression evaluates to truthy', () => {
      const isActive = true;
      expect(cn('btn', isActive && 'btn-active')).toBe('btn btn-active');
    });

    it('handles mixed truthy and falsy values in one call', () => {
      expect(cn('a', false, 'b', null, 'c', undefined)).toBe('a b c');
    });
  });

  describe('array and object inputs (clsx features)', () => {
    it('accepts an array of classes', () => {
      expect(cn(['text-sm', 'font-bold'])).toBe('text-sm font-bold');
    });

    it('accepts an object with boolean values', () => {
      expect(cn({ 'text-sm': true, 'font-bold': false })).toBe('text-sm');
    });

    it('accepts mixed arrays and strings', () => {
      expect(cn('base', ['extra', 'class'])).toBe('base extra class');
    });
  });
});
