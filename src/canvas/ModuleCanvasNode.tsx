import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AutoField } from './AutoField';
import { ModuleIcon } from './moduleIcons';
import { pinOptionsForPort } from './pinOptions';
import { deriveModuleInstances, useWiringStore, type ModuleNodeData } from './wiringStore';
import { getModuleDefinition } from '../modules/registry';
import { useSimulationStore } from '../simulation/simulationStore';
import { useBoardStore } from '../upload/boardStore';

/**
 * Node React Flow untuk satu instance part — sengaja dibuat SEMINIM mungkin di kanvas:
 * cuma preview part (mis. lingkaran LED) + titik pin buat sambungan kabel. Tidak ada
 * dropdown/parameter yang nempel di kanvas supaya kartu tetap kecil dan kanvas bersih.
 * Klik kartunya untuk buka modal konfigurasi (pilih pin tiap port + parameter kosmetik).
 * Modal di-render lewat portal ke document.body — wajib, karena node ini ada di dalam
 * `.react-flow__viewport` yang punya CSS transform (buat pan/zoom), dan `position: fixed`
 * di dalam elemen ber-transform tidak lagi relatif ke viewport asli.
 */
export function ModuleCanvasNode({ id, data }: NodeProps & { data: ModuleNodeData }) {
  const def = getModuleDefinition(data.moduleId);
  const runtimeState = useSimulationStore((s) => s.moduleRuntimeState[id]);
  const removeModule = useWiringStore((s) => s.removeModule);
  const setPin = useWiringStore((s) => s.setPin);
  const updateModuleParams = useWiringStore((s) => s.updateModuleParams);
  const nodes = useWiringStore((s) => s.nodes);
  const allModules = useMemo(() => deriveModuleInstances(nodes), [nodes]);
  const running = useSimulationStore((s) => s.status === 'running');
  const boardId = useBoardStore((s) => s.boardId);
  const [configOpen, setConfigOpen] = useState(false);

  if (!def) {
    return <div className="part-chip part-chip--unknown">Part tidak dikenal: {data.moduleId}</div>;
  }

  // Digabung di atas initialState (bukan dipakai apa adanya) — patchModuleState() cuma
  // menyimpan field yang di-patch waktu belum pernah disentuh sama sekali (mis. klik
  // "Acak" sebelum simulasi pernah dijalankan), jadi runtimeState bisa jadi objek PARSIAL
  // yang field lainnya undefined. Tanpa merge ini, part dengan >1 field state (mis. RFID
  // uidA/uidB) bisa crash baca `.length` dari field yang belum pernah di-patch.
  const state = runtimeState
    ? { ...(def.initialState as Record<string, unknown>), ...(runtimeState as Record<string, unknown>) }
    : def.initialState;
  const RenderComponent = def.RenderComponent;
  const missingRequired = def.ports.some((p) => p.required && !data.pins[p.id]);

  return (
    <>
      <div className={`part-chip${missingRequired ? ' part-chip--incomplete' : ''}`}>
        <button
          type="button"
          className="part-chip__delete nodrag nopan"
          title="Hapus part"
          disabled={running}
          onClick={(e) => {
            e.stopPropagation();
            removeModule(id);
          }}
        >
          <Trash2 size={12} />
        </button>
        {/* Badge ikon = tombol buka modal konfigurasi (pin & parameter). Dipisah dari area
            preview supaya preview part yang interaktif (tombol, toggle, slider, dst) tetap
            bisa ditekan/digeser langsung tanpa ke-ganggu modal konfigurasi. */}
        <button
          type="button"
          className="part-chip__badge nodrag nopan"
          title={`${def.title} — atur pin & parameter`}
          onClick={() => setConfigOpen(true)}
        >
          <ModuleIcon name={def.icon} size={11} />
        </button>

        {/* nodrag/nopan: tanpa ini React Flow menangkap pointerdown di sini buat deteksi
            drag node / pan kanvas, yang bikin interaksi asli part (tekan tombol, geser
            slider) tidak jalan — terutama pas simulasi jalan (node kehilangan class
            "nopan" bawaan React Flow begitu nodesDraggable/elementsSelectable dimatikan). */}
        <div className="part-chip__preview nodrag nowheel nopan">
          <RenderComponent instanceId={id} state={state} params={data.params} />
        </div>

        <div className="part-chip__terminals">
          {def.ports.map((port) => {
            const pinId = data.pins[port.id];
            return (
              <Handle
                key={port.id}
                type="target"
                position={Position.Top}
                id={`port:${port.id}`}
                isConnectable={false}
                className={`wire-dot${pinId ? ' wire-dot--active' : ''}`}
                title={pinId ? `${port.label} → ${pinId}` : `${port.label} — belum tersambung`}
              />
            );
          })}
        </div>
      </div>

      {configOpen &&
        createPortal(
          <div className="part-picker-overlay" onClick={() => setConfigOpen(false)}>
            <div className="part-config-modal" onClick={(e) => e.stopPropagation()}>
              <header className="part-config-modal__header">
                <div className="part-config-modal__title">
                  <ModuleIcon name={def.icon} size={18} className="part-card__icon" />
                  <span>{def.title}</span>
                </div>
                <button type="button" className="part-picker__close" onClick={() => setConfigOpen(false)} aria-label="Tutup">
                  <X size={18} />
                </button>
              </header>

              <div className="part-config-modal__body">
                <section className="part-config-modal__section">
                  <h3>Sambungan pin</h3>
                  <div className="part-card__pins">
                    {def.ports.map((port) => {
                      const groups = pinOptionsForPort(boardId, port, allModules, id, port.id);
                      return (
                        <label key={port.id} className="part-card__pin-row">
                          <span className="part-card__pin-label">
                            {port.label}
                            {port.required && (
                              <span className="part-card__required" title="Wajib disambung">
                                *
                              </span>
                            )}
                          </span>
                          <select
                            value={data.pins[port.id] ?? ''}
                            disabled={running}
                            onChange={(e) => setPin(id, port.id, e.target.value || undefined, boardId)}
                          >
                            <option value="">— Pilih pin —</option>
                            {groups.map(({ group, options }) => (
                              <optgroup key={group} label={group}>
                                {options.map(({ pin, disabled }) => (
                                  <option key={pin.id} value={pin.id} disabled={disabled}>
                                    {pin.label}
                                    {disabled ? ' (terpakai)' : ''}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </label>
                      );
                    })}
                  </div>
                </section>

                {(def.ParamForm || def.paramSchema.length > 0) && (
                  <section className="part-config-modal__section">
                    <h3>Parameter</h3>
                    {def.ParamForm ? (
                      <def.ParamForm
                        instanceId={id}
                        params={data.params}
                        onChange={(patch) => updateModuleParams(id, patch)}
                      />
                    ) : (
                      <div className="part-card__params">
                        {def.paramSchema.map((field) => (
                          <label key={field.key} className="part-card__param-row">
                            <span>{field.label}</span>
                            <AutoField
                              field={field}
                              value={data.params[field.key] ?? field.default}
                              onChange={(v) => updateModuleParams(id, { [field.key]: v })}
                            />
                          </label>
                        ))}
                      </div>
                    )}
                  </section>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
