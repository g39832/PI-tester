import type { WorkflowStage } from './KioskProvider';

interface Step {
  id: WorkflowStage;
  label: string;
}

const STEPS: Step[] = [
  { id: 'ready', label: 'Ready' },
  { id: 'scanning', label: 'Scan' },
  { id: 'diagnosing', label: 'Diagnose' },
  { id: 'review', label: 'Review' },
  { id: 'assign_sku', label: 'SKU' },
  { id: 'save_device', label: 'Save' },
  { id: 'next_ready', label: 'Done' },
];

const STEP_INDEX: Record<WorkflowStage, number> = {
  ready: 0,
  scanning: 1,
  diagnosing: 2,
  review: 3,
  assign_sku: 4,
  save_device: 5,
  next_ready: 6,
};

export function StepIndicator({ current }: { current: WorkflowStage }) {
  const currentIdx = STEP_INDEX[current] ?? 0;

  return (
    <div className="flex items-center justify-center gap-3 py-4">
      {STEPS.map((s, i) => {
        let cls = 'step-dot';
        if (i === currentIdx) cls += ' active';
        else if (i < currentIdx) cls += ' completed';
        return (
          <div key={s.id} className="flex items-center gap-3">
            <div className={cls} title={s.label} />
            {i < STEPS.length - 1 && (
              <div className={`w-8 h-0.5 rounded transition-colors duration-300 ${i < currentIdx ? 'bg-green-600' : 'bg-gray-700'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
