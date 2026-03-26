import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusBadge from '../StatusBadge';
import type { CandidateStatus } from '@/types/recruitment';

describe('StatusBadge', () => {
  // ── Label rendering ────────────────────────────────────────────────────────

  it('renders the label "New" for status "new"', () => {
    render(<StatusBadge status="new" />);
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('renders the label "Screening" for status "screening"', () => {
    render(<StatusBadge status="screening" />);
    expect(screen.getByText('Screening')).toBeInTheDocument();
  });

  it('renders the label "Interview" for status "interview"', () => {
    render(<StatusBadge status="interview" />);
    expect(screen.getByText('Interview')).toBeInTheDocument();
  });

  it('renders the label "Offer" for status "offer"', () => {
    render(<StatusBadge status="offer" />);
    expect(screen.getByText('Offer')).toBeInTheDocument();
  });

  it('renders the label "Placed" for status "placed"', () => {
    render(<StatusBadge status="placed" />);
    expect(screen.getByText('Placed')).toBeInTheDocument();
  });

  it('renders the label "Rejected" for status "rejected"', () => {
    render(<StatusBadge status="rejected" />);
    expect(screen.getByText('Rejected')).toBeInTheDocument();
  });

  // ── CSS class smoke-tests ──────────────────────────────────────────────────
  // We verify that the correct Tailwind colour utility is applied so that
  // the badge is visually distinct for each status.

  it('applies info colour classes for status "new"', () => {
    render(<StatusBadge status="new" />);
    const badge = screen.getByText('New');
    expect(badge).toHaveClass('text-info');
  });

  it('applies warning colour classes for status "screening"', () => {
    render(<StatusBadge status="screening" />);
    const badge = screen.getByText('Screening');
    expect(badge).toHaveClass('text-warning');
  });

  it('applies primary colour classes for status "interview"', () => {
    render(<StatusBadge status="interview" />);
    const badge = screen.getByText('Interview');
    expect(badge).toHaveClass('text-primary');
  });

  it('applies success colour classes for status "placed"', () => {
    render(<StatusBadge status="placed" />);
    const badge = screen.getByText('Placed');
    expect(badge).toHaveClass('text-success');
  });

  it('applies destructive colour classes for status "rejected"', () => {
    render(<StatusBadge status="rejected" />);
    const badge = screen.getByText('Rejected');
    expect(badge).toHaveClass('text-destructive');
  });

  // ── Structural tests ───────────────────────────────────────────────────────

  it('always renders a <span> element', () => {
    render(<StatusBadge status="new" />);
    const badge = screen.getByText('New');
    expect(badge.tagName).toBe('SPAN');
  });

  it('always carries the shared pill shape classes', () => {
    render(<StatusBadge status="placed" />);
    const badge = screen.getByText('Placed');
    expect(badge).toHaveClass('rounded-full', 'text-xs', 'font-medium');
  });

  // ── Parametrised coverage for all statuses ─────────────────────────────────

  const allStatuses: Array<{ status: CandidateStatus; label: string }> = [
    { status: 'new',       label: 'New' },
    { status: 'screening', label: 'Screening' },
    { status: 'interview', label: 'Interview' },
    { status: 'offer',     label: 'Offer' },
    { status: 'placed',    label: 'Placed' },
    { status: 'rejected',  label: 'Rejected' },
  ];

  allStatuses.forEach(({ status, label }) => {
    it(`renders without crashing and shows correct label for status "${status}"`, () => {
      render(<StatusBadge status={status} />);
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });
});
