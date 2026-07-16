import { lazy, Suspense } from 'react';
import { KioskProvider, useKiosk } from './components/kiosk/KioskProvider';
import { StageTransition } from './components/kiosk/StageTransition';

const ReadyStage = lazy(() => import('./workflow/ReadyStage').then((m) => ({ default: m.ReadyStage })));
const ScanningStage = lazy(() => import('./workflow/ScanningStage').then((m) => ({ default: m.ScanningStage })));
const DiagnosingStage = lazy(() => import('./workflow/DiagnosingStage').then((m) => ({ default: m.DiagnosingStage })));
const ReviewStage = lazy(() => import('./workflow/ReviewStage').then((m) => ({ default: m.ReviewStage })));
const AssignSkuStage = lazy(() => import('./workflow/AssignSkuStage').then((m) => ({ default: m.AssignSkuStage })));
const SaveDeviceStage = lazy(() => import('./workflow/SaveDeviceStage').then((m) => ({ default: m.SaveDeviceStage })));
const NextReadyStage = lazy(() => import('./workflow/NextReadyStage').then((m) => ({ default: m.NextReadyStage })));

function WorkflowRouter() {
  const { stage } = useKiosk();

  return (
    <StageTransition>
      <Suspense fallback={<div className="flex items-center justify-center h-screen bg-gray-950"><div className="text-gray-500">Loading...</div></div>}>
        {stage === 'ready' && <ReadyStage />}
        {stage === 'scanning' && <ScanningStage />}
        {stage === 'diagnosing' && <DiagnosingStage />}
        {stage === 'review' && <ReviewStage />}
        {stage === 'assign_sku' && <AssignSkuStage />}
        {stage === 'save_device' && <SaveDeviceStage />}
        {stage === 'next_ready' && <NextReadyStage />}
      </Suspense>
    </StageTransition>
  );
}

export default function App() {
  return (
    <KioskProvider>
      <WorkflowRouter />
    </KioskProvider>
  );
}
