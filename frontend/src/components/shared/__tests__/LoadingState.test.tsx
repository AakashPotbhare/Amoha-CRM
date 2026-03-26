import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadingState, PageLoader } from '../LoadingState';

describe('LoadingState', () => {
  it('renders without crashing when given no props', () => {
    const { container } = render(<LoadingState />);
    // The spinner SVG from lucide-react is rendered inside the component
    expect(container.firstChild).toBeInTheDocument();
  });

  it('does not render a message paragraph when no message prop is given', () => {
    render(<LoadingState />);
    // There should be no <p> element — message is conditional
    expect(screen.queryByRole('paragraph')).not.toBeInTheDocument();
  });

  it('renders the custom message when the message prop is provided', () => {
    render(<LoadingState message="Fetching data..." />);
    expect(screen.getByText('Fetching data...')).toBeInTheDocument();
  });

  it('renders a different custom message correctly', () => {
    render(<LoadingState message="Please wait" />);
    expect(screen.getByText('Please wait')).toBeInTheDocument();
  });

  it('applies the sm size class when size="sm"', () => {
    const { container } = render(<LoadingState size="sm" />);
    // The Loader2 icon should carry the sm size class
    const spinner = container.querySelector('svg');
    expect(spinner).toHaveClass('w-4', 'h-4');
  });

  it('applies the md size class by default', () => {
    const { container } = render(<LoadingState />);
    const spinner = container.querySelector('svg');
    expect(spinner).toHaveClass('w-6', 'h-6');
  });

  it('applies the lg size class when size="lg"', () => {
    const { container } = render(<LoadingState size="lg" />);
    const spinner = container.querySelector('svg');
    expect(spinner).toHaveClass('w-10', 'h-10');
  });

  it('applies a custom className to the wrapper element', () => {
    const { container } = render(<LoadingState className="my-custom-class" />);
    expect(container.firstChild).toHaveClass('my-custom-class');
  });

  it('renders the animate-spin class on the spinner', () => {
    const { container } = render(<LoadingState />);
    const spinner = container.querySelector('svg');
    expect(spinner).toHaveClass('animate-spin');
  });
});

describe('PageLoader', () => {
  it('renders without crashing', () => {
    const { container } = render(<PageLoader />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('shows the "Loading..." text', () => {
    render(<PageLoader />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});
