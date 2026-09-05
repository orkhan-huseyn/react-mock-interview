import { render, screen } from '@testing-library/react';
import App from './App';

// Proves the test setup works. Replace or extend during the interview.
test('renders the heading', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /transactions/i })).toBeInTheDocument();
});
