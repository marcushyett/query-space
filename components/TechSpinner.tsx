'use client';

interface TechSpinnerProps {
  size?: 'small' | 'default' | 'large';
}

export function TechSpinner({ size = 'default' }: TechSpinnerProps) {
  const dotSize = size === 'small' ? 6 : size === 'large' ? 10 : 8;
  const gap = size === 'small' ? 2 : size === 'large' ? 4 : 3;

  return (
    <span className="custom-spinner" role="status" aria-label="Loading">
      <span
        className="custom-spinner-dot"
        style={{ width: dotSize, height: dotSize, marginRight: gap }}
      />
      <span
        className="custom-spinner-dot"
        style={{ width: dotSize, height: dotSize, marginRight: gap }}
      />
      <span
        className="custom-spinner-dot"
        style={{ width: dotSize, height: dotSize }}
      />
    </span>
  );
}
