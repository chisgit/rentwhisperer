// Import jest-dom for assertions
import '@testing-library/jest-dom';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
  useLocation: () => ({
    pathname: '/',
    search: '',
    hash: '',
    state: null,
  }),
}));

// Suppress specific console logs during testing
const originalLog = console.log;
console.log = (...args) => {
  // Filter out specific logs you want to suppress during tests
  const suppressPatterns = [
    'Payment confirmed:',
    'Error fetching payments:'
  ];

  if (!suppressPatterns.some(pattern =>
    typeof args[0] === 'string' && args[0].includes(pattern)
  )) {
    originalLog(...args);
  }
};

// Suppress React 18 console errors in tests
const originalError = console.error;
console.error = (...args) => {
  // Filter out specific React error messages we don't care about in tests
  const ignoreMessages = [
    'Warning: ReactDOM.render',
    'Warning: `ReactDOMTestUtils.act`',
    'Warning: unmountComponentAtNode is deprecated'
  ];

  if (!ignoreMessages.some(message => args[0]?.includes(message))) {
    originalError(...args);
  }
};
