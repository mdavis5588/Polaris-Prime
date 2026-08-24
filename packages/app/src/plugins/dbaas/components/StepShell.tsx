import React from 'react';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';

interface StepShellProps {
  title: string;
  children: React.ReactNode;
  onNext?: () => void;
  onBack?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  showBack?: boolean;
}

/** Shared layout for each wizard step — title, content, and a Back/Next footer. */
export const StepShell = ({
  title,
  children,
  onNext,
  onBack,
  nextLabel = 'Next',
  nextDisabled,
  showBack = true,
}: StepShellProps) => (
  <Card style={{ maxWidth: 760, margin: '0 auto' }}>
    <CardContent>
      <Typography variant="h5" gutterBottom>
        {title}
      </Typography>
      {children}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '1.5rem',
        }}
      >
        {showBack && onBack ? (
          <Button onClick={onBack}>Back</Button>
        ) : (
          <span />
        )}
        {onNext && (
          <Button
            variant="contained"
            color="primary"
            onClick={onNext}
            disabled={nextDisabled}
          >
            {nextLabel}
          </Button>
        )}
      </div>
    </CardContent>
  </Card>
);
