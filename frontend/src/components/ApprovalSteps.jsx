import { Badge } from './common';

// Shows an approval chain: one row per step with its state. Used in the history modal and the chat side panel.
export default function ApprovalSteps({ request }) {
  if (!request.steps.length) return <span className="muted">Auto-approved (within the no-approval band)</span>;

  return (
    <div className="steps">
      {request.steps.map((s) => {
        const state = s.status === 'pending' && request.currentStep !== s.step ? 'waiting' : s.status;
        return (
          <div key={s.step} className="step">
            <span className={`step-no ${state}`}>{s.step}</span>
            <span style={{ flex: 1, textTransform: 'capitalize' }}>{s.roleName.replace('_', ' ')}</span>
            <Badge tone={{ approved: 'success', rejected: 'danger', pending: 'warning' }[state]}>
              {state === 'pending' ? 'awaiting decision' : state}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}
