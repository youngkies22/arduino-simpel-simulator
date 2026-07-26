import type { SimulationStatus } from '../simulation/simulationStore';

const LABEL: Record<SimulationStatus, string> = {
  idle: 'Siap',
  running: 'Berjalan',
  stopped: 'Berhenti',
  error: 'Error',
};

export function StatusPill({ status }: { status: SimulationStatus }) {
  return <span className={`status-pill status-pill--${status}`}>{LABEL[status]}</span>;
}
