import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import KPICard from '../KPICard';
import type { KPI } from '@/types/recruitment';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const increaseKPI: KPI = {
  label: 'Total Placements',
  value: 42,
  change: 12,
  changeType: 'increase',
};

const decreaseKPI: KPI = {
  label: 'Active Candidates',
  value: 18,
  change: 5,
  changeType: 'decrease',
};

const stringValueKPI: KPI = {
  label: 'Conversion Rate',
  value: '68%',
  change: 3,
  changeType: 'increase',
};

describe('KPICard', () => {
  // ── Label / title ──────────────────────────────────────────────────────────

  it('renders the kpi label', () => {
    render(<KPICard kpi={increaseKPI} />);
    expect(screen.getByText('Total Placements')).toBeInTheDocument();
  });

  it('renders a different kpi label correctly', () => {
    render(<KPICard kpi={decreaseKPI} />);
    expect(screen.getByText('Active Candidates')).toBeInTheDocument();
  });

  // ── Value ──────────────────────────────────────────────────────────────────

  it('renders a numeric value', () => {
    render(<KPICard kpi={increaseKPI} />);
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders a string value', () => {
    render(<KPICard kpi={stringValueKPI} />);
    expect(screen.getByText('68%')).toBeInTheDocument();
  });

  // ── Change / delta ─────────────────────────────────────────────────────────

  it('renders the change percentage with a % sign', () => {
    render(<KPICard kpi={increaseKPI} />);
    expect(screen.getByText('12%')).toBeInTheDocument();
  });

  it('renders the decrease change percentage', () => {
    render(<KPICard kpi={decreaseKPI} />);
    expect(screen.getByText('5%')).toBeInTheDocument();
  });

  // ── Colour classes reflect changeType ─────────────────────────────────────

  it('applies success colour class for an increase', () => {
    const { container } = render(<KPICard kpi={increaseKPI} />);
    // The change value is wrapped in a div alongside the icon; both share the colour class
    const changeWrapper = screen.getByText('12%').closest('div');
    expect(changeWrapper).toHaveClass('text-success');
  });

  it('applies destructive colour class for a decrease', () => {
    render(<KPICard kpi={decreaseKPI} />);
    const changeWrapper = screen.getByText('5%').closest('div');
    expect(changeWrapper).toHaveClass('text-destructive');
  });

  // ── Trend icon presence ────────────────────────────────────────────────────

  it('renders an SVG trend icon', () => {
    const { container } = render(<KPICard kpi={increaseKPI} />);
    // Both TrendingUp and TrendingDown render as SVG
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  // ── Structural / crash tests ───────────────────────────────────────────────

  it('renders without crashing with minimal props', () => {
    const minimalKPI: KPI = {
      label: 'Revenue',
      value: 0,
      change: 0,
      changeType: 'increase',
    };
    expect(() => render(<KPICard kpi={minimalKPI} />)).not.toThrow();
  });

  it('renders the card wrapper element', () => {
    const { container } = render(<KPICard kpi={increaseKPI} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders all three data points for an increase KPI', () => {
    render(<KPICard kpi={increaseKPI} />);
    expect(screen.getByText('Total Placements')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('12%')).toBeInTheDocument();
  });

  it('renders all three data points for a decrease KPI', () => {
    render(<KPICard kpi={decreaseKPI} />);
    expect(screen.getByText('Active Candidates')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.getByText('5%')).toBeInTheDocument();
  });
});
