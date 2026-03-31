interface ConfidenceBadgeProps {
  confidence: number;
  showValue?: boolean;
}

export default function ConfidenceBadge({ confidence, showValue = true }: ConfidenceBadgeProps) {
  let level: string;

  if (confidence >= 0.9) {
    level = 'high';
  } else if (confidence >= 0.7) {
    level = 'medium';
  } else {
    level = 'low';
  }

  return (
    <span className={`confidence-badge confidence-badge--${level}`}>
      {showValue ? `${(confidence * 100).toFixed(0)}%` : level.charAt(0).toUpperCase() + level.slice(1)}
    </span>
  );
}
