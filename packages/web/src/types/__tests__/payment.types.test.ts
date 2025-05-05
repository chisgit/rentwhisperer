import { Payment, PaymentConfirmationData } from '../payment.types';

// This file is just for type checking, not actual runtime tests
// TypeScript will catch type errors during compilation

describe('Payment Types', () => {
  test('Payment interface can be instantiated with correct properties', () => {
    const payment: Payment = {
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
    };

    expect(payment.id).toBe('1');
    expect(payment.amount).toBe(1000);
    expect(payment.status).toBe('pending');
  });

  test('PaymentConfirmationData can be instantiated', () => {
    const paymentConfirmation: PaymentConfirmationData = {
      id: '1',
      status: 'paid',
      payment_date: '2023-06-01',
      payment_method: 'cash',
      notes: 'Payment received'
    };

    expect(paymentConfirmation.id).toBe('1');
    expect(paymentConfirmation.status).toBe('paid');
    expect(paymentConfirmation.notes).toBe('Payment received');
  });
});
