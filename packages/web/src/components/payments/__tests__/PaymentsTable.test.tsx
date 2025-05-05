import { render, screen, fireEvent } from '@testing-library/react';
import PaymentsTable from '../PaymentsTable';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import '@testing-library/jest-dom';

// Mock the formatter utilities
jest.mock('../../../utils/formatters', () => ({
  formatCurrency: jest.fn(amount => `$${amount}`),
  formatDate: jest.fn(date => date || '—')
}));

const mockPayments = [
  {
    id: '1',
    tenant_id: '1',
    tenant_name: 'John Doe',
    unit_id: '101',
    unit_number: '101',
    amount: 1000,
    due_date: '2023-06-01',
    payment_date: null,
    status: 'pending',
    payment_method: null,
    interac_request_link: null
  },
  {
    id: '2',
    tenant_id: '2',
    tenant_name: 'Jane Smith',
    unit_id: '102',
    unit_number: '102',
    amount: 1200,
    due_date: '2023-06-01',
    payment_date: '2023-06-01',
    status: 'paid',
    payment_method: 'credit_card',
    interac_request_link: 'https://interac.ca/link'
  }
];

describe('PaymentsTable', () => {
  const mockOnMarkAsPaid = jest.fn();

  beforeEach(() => {
    mockOnMarkAsPaid.mockClear();
    (formatCurrency as jest.Mock).mockClear();
    (formatDate as jest.Mock).mockClear();
  });

  test('renders table with correct headers', () => {
    render(<PaymentsTable payments={mockPayments} onMarkAsPaid={mockOnMarkAsPaid} />);

    expect(screen.getByText('Tenant')).toBeInTheDocument();
    expect(screen.getByText('Unit')).toBeInTheDocument();
    expect(screen.getByText('Amount')).toBeInTheDocument();
    expect(screen.getByText('Due Date')).toBeInTheDocument();
    expect(screen.getByText('Payment Date')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Payment Method')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  test('renders payment rows with correct data', () => {
    render(<PaymentsTable payments={mockPayments} onMarkAsPaid={mockOnMarkAsPaid} />);

    // Check tenant names are displayed
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();

    // Check unit numbers
    expect(screen.getByText('101')).toBeInTheDocument();
    expect(screen.getByText('102')).toBeInTheDocument();

    // Check formatters are called
    expect(formatCurrency).toHaveBeenCalledWith(1000);
    expect(formatCurrency).toHaveBeenCalledWith(1200);
    expect(formatDate).toHaveBeenCalledWith('2023-06-01');
    expect(formatDate).toHaveBeenCalledWith(null);
  });

  test('calls onMarkAsPaid when Mark as Paid button is clicked', () => {
    render(<PaymentsTable payments={mockPayments} onMarkAsPaid={mockOnMarkAsPaid} />);

    // Find mark as paid buttons
    const markAsPaidButtons = screen.getAllByTitle('Mark as Paid');
    fireEvent.click(markAsPaidButtons[0]);

    expect(mockOnMarkAsPaid).toHaveBeenCalledWith(mockPayments[0]);
  });

  test('does not show Mark as Paid button for paid payments', () => {
    render(<PaymentsTable payments={mockPayments} onMarkAsPaid={mockOnMarkAsPaid} />);

    // Should have exactly one Mark as Paid button (for the pending payment)
    const markAsPaidButtons = screen.getAllByTitle('Mark as Paid');
    expect(markAsPaidButtons.length).toBe(1);
  });
});
