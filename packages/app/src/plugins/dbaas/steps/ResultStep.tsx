import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import type { ProvisionResult } from '../api';

interface ResultStepProps {
  result: ProvisionResult;
  onRestart: () => void;
}

export const ResultStep = ({ result, onRestart }: ResultStepProps) => (
  <Card style={{ maxWidth: 760, margin: '0 auto' }}>
    <CardContent>
      <Typography variant="h5" gutterBottom>
        {result.automated ? 'Provisioning Started' : 'Request Logged'}
      </Typography>

      {result.automated ? (
        <>
          <Typography paragraph>
            Provisioning has been initiated. This can take several minutes to
            complete.
          </Typography>
          {result.consoleUrl && (
            <Button
              variant="contained"
              color="primary"
              href={result.consoleUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open in Console
            </Button>
          )}
        </>
      ) : (
        <Typography paragraph color="textSecondary">
          {result.message}
        </Typography>
      )}

      <div style={{ marginTop: '1.5rem' }}>
        <Button onClick={onRestart}>Request Another Database</Button>
      </div>
    </CardContent>
  </Card>
);
