import { renderHook, act } from '@testing-library/react-hooks';
import { usePayments } from '../usePayments';
import api from '../../services/api.service';

// Mock the API service
jest.mock('../../services/api.service');

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
    interac_request_link: null
  }
];

describe('usePayments hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.payments.getPending as jest.Mock).mockResolvedValue(mockPayments);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('fetches payments on mount', async () => {
    const { result, waitForNextUpdate } = renderHook(() => usePayments());

    expect(result.current.loading).toBe(true);
    await waitForNextUpdate();

    expect(result.current.loading).toBe(false);
    expect(result.current.payments).toEqual(mockPayments);
    expect(result.current.filteredPayments).toEqual(mockPayments);
    expect(api.payments.getPending).toHaveBeenCalledTimes(1);
  });

  test('filters payments when filter changes', async () => {
    const { result, waitForNextUpdate } = renderHook(() => usePayments());
    await waitForNextUpdate();

    act(() => {
      result.current.setFilter('paid');
    });

    expect(result.current.filteredPayments).toEqual([mockPayments[1]]);

    act(() => {
      result.current.setFilter('pending');
    });

    expect(result.current.filteredPayments).toEqual([mockPayments[0]]);

    act(() => {
      result.current.setFilter('all');
    });

    expect(result.current.filteredPayments).toEqual(mockPayments);
  });

  test('handles payment confirmation', async () => {
    const { result, waitForNextUpdate } = renderHook(() => usePayments());
    await waitForNextUpdate();

    act(() => {
      result.current.handleConfirmPayment({
        id: '1',
        status: 'paid',
        payment_date: '2023-06-02',
        payment_method: 'cash'
      });
    });

    // Check that the payment was updated
    expect(result.current.payments[0].status).toBe('paid');
    expect(result.current.payments[0].payment_date).toBe('2023-06-02');
    expect(result.current.payments[0].payment_method).toBe('cash');
  });

  test('handles API error', async () => {
    (api.payments.getPending as jest.Mock).mockRejectedValue(new Error('API error'));

    const { result, waitForNextUpdate } = renderHook(() => usePayments());
    await waitForNextUpdate();

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('Failed to fetch payments. Please try again later.');
  });
});
