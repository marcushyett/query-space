'use client';

interface TechSpinnerProps {
  size?: 'small' | 'default' | 'large';
}

export function TechSpinner({ size = 'default' }: TechSpinnerProps) {
  const squareSize = size === 'small' ? 10 : size === 'large' ? 16 : 12;

  return (
    <span
      className="blinking-square"
      role="status"
      aria-label="Loading"
      style={{ width: squareSize, height: squareSize }}
    />
  );
}
