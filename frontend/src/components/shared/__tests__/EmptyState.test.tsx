import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Users } from 'lucide-react';
import { EmptyState } from '../EmptyState';

describe('EmptyState', () => {
  it('renders without crashing when only title is provided', () => {
    render(<EmptyState title="No results found" />);
    expect(screen.getByText('No results found')).toBeInTheDocument();
  });

  it('renders the title prop as a heading', () => {
    render(<EmptyState title="No candidates yet" />);
    expect(screen.getByRole('heading', { name: 'No candidates yet' })).toBeInTheDocument();
  });

  it('renders the description when the description prop is provided', () => {
    render(
      <EmptyState
        title="No results"
        description="Try adjusting your search filters."
      />
    );
    expect(screen.getByText('Try adjusting your search filters.')).toBeInTheDocument();
  });

  it('does not render a description paragraph when the prop is omitted', () => {
    render(<EmptyState title="No results" />);
    // Only the title h3 should be present; no description text
    expect(screen.queryByText(/try adjusting/i)).not.toBeInTheDocument();
  });

  it('renders action children when the action prop is provided', () => {
    render(
      <EmptyState
        title="No records"
        action={<button>Add New</button>}
      />
    );
    expect(screen.getByRole('button', { name: 'Add New' })).toBeInTheDocument();
  });

  it('does not render an action area when the action prop is omitted', () => {
    render(<EmptyState title="Nothing here" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('fires action handler when action button is clicked', () => {
    const handleClick = vi.fn();
    render(
      <EmptyState
        title="Empty"
        action={<button onClick={handleClick}>Create</button>}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it('renders the icon when the icon prop is provided', () => {
    const { container } = render(
      <EmptyState title="No users" icon={Users} />
    );
    // The lucide icon renders as an SVG element
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('does not render an icon container when no icon is provided', () => {
    const { container } = render(<EmptyState title="No users" />);
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });

  it('applies a custom className to the wrapper element', () => {
    const { container } = render(
      <EmptyState title="Empty" className="my-custom-class" />
    );
    expect(container.firstChild).toHaveClass('my-custom-class');
  });

  it('renders all props together without crashing', () => {
    render(
      <EmptyState
        title="No data"
        description="Nothing has been added yet."
        icon={Users}
        action={<button>Get started</button>}
      />
    );
    expect(screen.getByText('No data')).toBeInTheDocument();
    expect(screen.getByText('Nothing has been added yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Get started' })).toBeInTheDocument();
  });
});
