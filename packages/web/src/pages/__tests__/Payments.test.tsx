import { render, screen, fireEvent } from '@testing-library/react';
import Payments from '../Payments';
import { usePayments } from '../../hooks/usePayments';
import '@testing-library/jest-dom';

// Mock the hooks and components
jest.mock('../../hooks/usePayments');

jest.mock('../../components/PaymentConfirmationModal', () => ({
  __esModule: true,
  default: ({ payment, onClose, onConfirm }) => (
    <div data-testid="payment-modal">
      <button onClick={() => onConfirm({
        id: payment.id,
        status: 'paid',
        payment_date: '2023-06-01',
        payment_method: 'cash'
      })}>
        Confirm Payment
      </button>
      <button onClick={onClose}>Close</button>
    </div>
  )
}));

jest.mock('../../components/payments/PaymentsTable', () => ({
  __esModule: true,
  default: ({ payments, onMarkAsPaid }) => (
    <div data-testid="payments-table">
      {payments.map(payment => (
        <div key={payment.id} data-testid={`payment-${payment.id}`}>
          <button onClick={() => onMarkAsPaid(payment)}>Mark as paid</button>
        </div>
      ))}
    </div>
  )
}));

jest.mock('../../components/payments/PaymentFilters', () => ({
  __esModule: true,
  default: ({ filter, setFilter }) => (
    <div data-testid="payment-filters">
      <button onClick={() => setFilter('all')}>All</button>
      <button onClick={() => setFilter('pending')}>Pending</button>
    </div>
  )
}));

describe('Payments Page', () => {
  beforeEach(() => {
    (usePayments as jest.Mock).mockReturnValue({
      payments: [],
      filteredPayments: [
        {
          id: '1',
          tenant_name: 'John Doe',
          unit_number: '101',
          amount: 1200,
          due_date: '2023-06-01',
          payment_date: null,
          status: 'pending',
          payment_method: null,
          tenant_id: '1',
          unit_id: '1',
          interac_request_link: null
        }
      ],
      loading: false,
      error: null,
      filter: 'all',
      setFilter: jest.fn(),
      handleConfirmPayment: jest.fn()
    });
  });

  test('renders without crashing', () => {
    render(<Payments />);
    expect(screen.getByText('Rent Payments')).toBeInTheDocument();
  });

  test('shows loading state', () => {
    (usePayments as jest.Mock).mockReturnValue({
      loading: true,
      error: null
    });
    render(<Payments />);
    expect(screen.getByText('Loading payment data...')).toBeInTheDocument();
  });

  test('shows error state', () => {
    (usePayments as jest.Mock).mockReturnValue({
      loading: false,
      error: 'Failed to load data',
      payments: [],
      filteredPayments: []
    });
    render(<Payments />);
    expect(screen.getByText('Failed to load data')).toBeInTheDocument();
  });

  test('shows payment confirmation modal when marking a payment as paid', () => {
    render(<Payments />);
    const markAsPaidButton = screen.getByText('Mark as paid');
    fireEvent.click(markAsPaidButton);
    expect(screen.getByTestId('payment-modal')).toBeInTheDocument();
  });

  test('closes payment confirmation modal', () => {
    render(<Payments />);
    // Open the modal first
    const markAsPaidButton = screen.getByText('Mark as paid');
    fireEvent.click(markAsPaidButton);

    // Now close it
    const closeButton = screen.getByText('Close');
    fireEvent.click(closeButton);
    expect(screen.queryByTestId('payment-modal')).not.toBeInTheDocument();
  });
});
