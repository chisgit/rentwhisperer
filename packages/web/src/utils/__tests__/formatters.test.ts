import { formatCurrency, formatDate } from '../formatters';

describe('formatters', () => {
  describe('formatCurrency', () => {
    test('formats number as CAD currency', () => {
      // Mock the Intl.NumberFormat for consistent testing
      const originalNumberFormat = Intl.NumberFormat;
      global.Intl.NumberFormat = jest.fn().mockImplementation(() => ({
        format: (num: number) => `CA$${num.toFixed(2)}`
      }));

      expect(formatCurrency(1000)).toBe('CA$1000.00');
      expect(formatCurrency(1234.56)).toBe('CA$1234.56');

      // Restore original implementation
      global.Intl.NumberFormat = originalNumberFormat;
    });
  });

  describe('formatDate', () => {
    test('returns dash for null dates', () => {
      expect(formatDate(null)).toBe('—');
    });

    test('formats date string correctly', () => {
      expect(formatDate('2023-06-01')).toBe('2023-06-01');
    });

    test('handles date parts correctly', () => {
      expect(formatDate('2023-6-1')).toBe('2023-6-1');
      expect(formatDate('2023-06-7')).toBe('2023-06-7');
    });
  });
});
