import { render, screen, fireEvent } from '@testing-library/react';
import PaymentFilters from '../PaymentFilters';
import '@testing-library/jest-dom';

describe('PaymentFilters', () => {
  const mockSetFilter = jest.fn();

  beforeEach(() => {
    mockSetFilter.mockClear();
  });

  test('renders all filter buttons', () => {
    render(<PaymentFilters filter="all" setFilter={mockSetFilter} />);

    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(screen.getByText('Late')).toBeInTheDocument();
  });

  test('applies active class to selected filter', () => {
    render(<PaymentFilters filter="pending" setFilter={mockSetFilter} />);

    // Find the button with text "Pending"
    const pendingButton = screen.getByText('Pending');
    // Find the parent element that should have the active class
    const pendingButtonParent = pendingButton.closest('.filter-btn');
    expect(pendingButtonParent).toHaveClass('active');

    // Similar check for "All" button, which should not be active
    const allButton = screen.getByText('All');
    const allButtonParent = allButton.closest('.filter-btn');
    expect(allButtonParent).not.toHaveClass('active');
  });

  test('calls setFilter with correct value when filter is clicked', () => {
    render(<PaymentFilters filter="all" setFilter={mockSetFilter} />);

    fireEvent.click(screen.getByText('Pending'));
    expect(mockSetFilter).toHaveBeenCalledWith('pending');

    fireEvent.click(screen.getByText('Paid'));
    expect(mockSetFilter).toHaveBeenCalledWith('paid');

    fireEvent.click(screen.getByText('Late'));
    expect(mockSetFilter).toHaveBeenCalledWith('late');

    fireEvent.click(screen.getByText('All'));
    expect(mockSetFilter).toHaveBeenCalledWith('all');
  });
});
