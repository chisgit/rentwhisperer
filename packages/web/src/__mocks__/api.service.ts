const api = {
  payments: {
    getPending: jest.fn().mockResolvedValue([
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
    ]),
    confirmPayment: jest.fn().mockResolvedValue({ success: true }),
    recordPayment: jest.fn().mockResolvedValue({ success: true })
  }
};

export default api;
