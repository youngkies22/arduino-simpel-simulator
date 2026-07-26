import { ReactFlowProvider, useReactFlow, type ReactFlowInstance } from '@xyflow/react';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { PartPicker } from './PartPicker';
import { WiringStage } from './WiringStage';
import { useWiringStore } from './wiringStore';
import { getModuleDefinition } from '../modules/registry';
import { useSimulationStore } from '../simulation/simulationStore';

/** Titik tengah area kanvas yang SEDANG TERLIHAT (bukan koordinat kanvas absolut) —
 * dikonversi lewat `screenToFlowPosition` supaya part baru ikut posisi board/viewport
 * saat ini, bukan selalu muncul di titik tetap yang bisa jadi sudah jauh dari pandangan
 * kalau board sudah digeser atau kanvas di-pan/zoom. */
function visibleCenterFlowPosition(reactFlow: ReactFlowInstance): { x: number; y: number } | undefined {
  const rect = document.querySelector('.wiring-stage .react-flow')?.getBoundingClientRect();
  if (!rect || rect.width === 0 || rect.height === 0) return undefined; // panel HP masih disembunyikan (display:none)
  return reactFlow.screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
}

function PartsPanelInner() {
  const addModule = useWiringStore((s) => s.addModule);
  const running = useSimulationStore((s) => s.status === 'running');
  const [pickerOpen, setPickerOpen] = useState(false);
  const reactFlow = useReactFlow();

  const handlePick = (moduleId: string) => {
    const def = getModuleDefinition(moduleId);
    if (!def) return;
    const initialParams = Object.fromEntries(def.paramSchema.map((f) => [f.key, f.default]));
    addModule(moduleId, initialParams, visibleCenterFlowPosition(reactFlow));
    setPickerOpen(false);
  };

  return (
    <section className="parts-panel">
      <div className="parts-panel__header">
        <h2 className="parts-panel__title">Komponen</h2>
        <button type="button" className="parts-panel__add" disabled={running} onClick={() => setPickerOpen(true)}>
          <Plus size={15} />
          <span>Tambah part</span>
        </button>
      </div>

      {pickerOpen && <PartPicker onPick={handlePick} onClose={() => setPickerOpen(false)} />}

      <WiringStage />
    </section>
  );
}

/** ReactFlowProvider dipasang di sini (bukan di dalam WiringStage lagi) supaya tombol
 * "Tambah part" di atas ikut bisa panggil useReactFlow() — perlu tahu area kanvas yang
 * sedang terlihat buat menaruh part baru di situ (lihat visibleCenterFlowPosition). */
export function PartsPanel() {
  return (
    <ReactFlowProvider>
      <PartsPanelInner />
    </ReactFlowProvider>
  );
}
