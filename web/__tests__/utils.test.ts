import { cn } from '../app/lib/utils';

describe('cn — className merger', () => {
  it('joins two class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('omits falsy values', () => {
    expect(cn('foo', false, undefined, null as any, 'bar')).toBe('foo bar');
  });

  it('resolves Tailwind conflicts — last wins', () => {
    // twMerge: p-4 and p-8 on the same axis → last wins
    expect(cn('p-4', 'p-8')).toBe('p-8');
  });

  it('resolves text-color conflicts', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('handles conditional classes via objects', () => {
    expect(cn('base', { active: true, hidden: false })).toBe('base active');
  });

  it('handles array inputs', () => {
    expect(cn(['a', 'b'], 'c')).toBe('a b c');
  });

  it('returns empty string when all inputs are falsy', () => {
    expect(cn(false as any, undefined)).toBe('');
  });

  it('does not duplicate non-conflicting classes', () => {
    const result = cn('flex', 'items-center', 'gap-4');
    expect(result).toBe('flex items-center gap-4');
  });
});
