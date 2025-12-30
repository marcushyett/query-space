'use client';

interface TechSpinnerProps {
  size?: 'small' | 'default' | 'large';
}

export function TechSpinner({ size = 'default' }: TechSpinnerProps) {
  const squareSize = size === 'small' ? 12 : size === 'large' ? 24 : 16;

  return (
    <span
      className="blinking-square"
      role="status"
      aria-label="Loading"
      style={{ width: squareSize, height: squareSize }}
    />
  );
}
