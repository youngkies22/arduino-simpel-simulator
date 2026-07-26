import type { Node, NodeChange } from '@xyflow/react';
import { applyNodeChanges } from '@xyflow/react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BoardId } from './boardPinLayout';
import { findPinById } from './boardPinLayout';

export const BOARD_NODE_ID = 'board';

/** Pin ground/power (rel bersama di breadboard nyata) boleh dipakai banyak modul
 * sekaligus — beda dari pin sinyal (digital/analog/pwm) yang cuma boleh satu sambungan. */
function isShareablePin(boardId: BoardId, pinId: string): boolean {
  const pin = findPinById(boardId, pinId);
  return pin ? pin.kinds.includes('ground') || pin.kinds.includes('power') : false;
}

/** Data yang disimpan di tiap node modul React Flow: identitas part, parameter kosmetik, dan pin pilihan. */
export interface ModuleNodeData extends Record<string, unknown> {
  moduleId: string;
  params: Record<string, unknown>;
  /** portId -> pinId (mis. { anode: 'D13' }). Port yang belum dipilih pin-nya tidak punya entry di sini. */
  pins: Record<string, string>;
}

/** Bentuk datar satu instance part — dipakai kode non-kanvas (resolvePinMapping, simulationStore, pinOptions). */
export interface ModuleInstance {
  instanceId: string;
  moduleId: string;
  params: Record<string, unknown>;
  pins: Record<string, string>;
}

/** Dipakai baik oleh store method `getModuleInstances` maupun hook reaktif di komponen
 * (lewat useMemo) — logikanya sama, jangan diduplikasi. */
export function deriveModuleInstances(nodes: Node[]): ModuleInstance[] {
  const result: ModuleInstance[] = [];
  for (const n of nodes) {
    if (n.type !== 'module') continue;
    const data = n.data as ModuleNodeData;
    result.push({ instanceId: n.id, moduleId: data.moduleId, params: data.params, pins: data.pins });
  }
  return result;
}

const BOARD_NODE: Node = {
  id: BOARD_NODE_ID,
  type: 'board',
  position: { x: 60, y: 40 },
  data: {},
  draggable: true,
  deletable: false,
};

interface WiringState {
  nodes: Node[];
  running: boolean;
  onNodesChange: (changes: NodeChange[]) => void;
  /** `spawnAt` opsional: titik tengah area kanvas yang sedang terlihat (dalam koordinat
   * flow, dari `screenToFlowPosition`), dihitung PartsPanel.tsx supaya part baru muncul
   * di dekat board/pandangan user saat itu, bukan di koordinat kanvas yang tetap — kalau
   * board sudah digeser jauh atau kanvasnya di-pan/zoom, part baru dulu selalu muncul di
   * titik yang sama, jadi kelihatan "jauh dari board". Dikosongkan = fallback ke grid tetap
   * (dipakai test & saat React Flow belum siap). */
  addModule: (moduleId: string, initialParams: Record<string, unknown>, spawnAt?: { x: number; y: number }) => string;
  updateModuleParams: (instanceId: string, patch: Record<string, unknown>) => void;
  removeModule: (instanceId: string) => void;
  /** Set pin sebuah port. pinId undefined = lepas sambungan. Pin yang sama otomatis dilepas
   * dari port lain (satu pin = satu sambungan). `boardId` menentukan tabel pin yang dipakai
   * buat mengenali pin ground/power (rel bersama) — beda board, beda tabel. */
  setPin: (instanceId: string, portId: string, pinId: string | undefined, boardId: BoardId) => void;
  setRunning: (running: boolean) => void;
  /** Ganti seluruh rangkaian sekaligus — dipakai saat membuka projek tersimpan. */
  loadNodes: (nodes: Node[]) => void;
  /** Lepas SEMUA sambungan pin di seluruh modul (part tetap ada di kanvas, cuma pin-nya
   * dikosongkan) — dipanggil saat board diganti, karena id pin yang sama (mis. "D2") bisa
   * berarti pin fisik yang beda total di board lain. */
  clearAllPins: () => void;
  /** Buang SEMUA part dari kanvas (node board TETAP ADA, tidak ikut terhapus — beda dari
   * loadNodes/clearAllPins). Dipakai tombol "Reset Komponen" di toolbar. */
  resetModules: () => void;
  getModuleInstances: () => ModuleInstance[];
  moduleIdByInstance: () => Map<string, string>;
}

export const useWiringStore = create<WiringState>()(
  persist(
    (set, get) => ({
      nodes: [BOARD_NODE],
      running: false,

      onNodesChange: (changes) => set({ nodes: applyNodeChanges(changes, get().nodes) }),

      addModule: (moduleId, initialParams, spawnAt) => {
        const instanceId = crypto.randomUUID();
        const moduleCount = get().nodes.filter((n) => n.type === 'module').length;
        // Beberapa part ditambah beruntun dari titik tengah yang SAMA (viewport tidak
        // bergerak di antara klik) -- dikipas kecil dalam grid 3x3 di sekitar titik itu
        // supaya tidak saling numpuk persis, lalu berulang (modulo 9) biar tidak makin
        // menjauh kalau part-nya banyak sekali.
        const col = moduleCount % 3;
        const row = Math.floor(moduleCount / 3) % 3;
        const position = spawnAt
          ? // +170 di sumbu-Y: papan board biasanya JUGA di tengah viewport (apalagi
            // baru fitView), jadi titik tengah persis dipakai apa adanya bikin part
            // pertama nimpa papannya. Didorong ke bawah papan, bukan pas di tengahnya.
            { x: spawnAt.x - 110 + col * 130, y: spawnAt.y + 170 + row * 120 }
          : { x: 60 + col * 260, y: 260 + row * 240 };
        const node: Node<ModuleNodeData> = {
          id: instanceId,
          type: 'module',
          position,
          data: { moduleId, params: initialParams, pins: {} },
        };
        set({ nodes: [...get().nodes, node] });
        return instanceId;
      },

      updateModuleParams: (instanceId, patch) => {
        set({
          nodes: get().nodes.map((n) =>
            n.id === instanceId
              ? { ...n, data: { ...n.data, params: { ...(n.data as ModuleNodeData).params, ...patch } } }
              : n,
          ),
        });
      },

      removeModule: (instanceId) => {
        set({ nodes: get().nodes.filter((n) => n.id !== instanceId) });
      },

      setPin: (instanceId, portId, pinId, boardId) => {
        // Pin ground/power boleh dipakai bersama (rel bersama, gaya breadboard nyata) —
        // hanya pin sinyal yang direbut dari port lain saat dipilih ulang di sini.
        const shareable = pinId ? isShareablePin(boardId, pinId) : false;
        set({
          nodes: get().nodes.map((n) => {
            if (n.type !== 'module') return n;
            const data = n.data as ModuleNodeData;
            const pins = shareable
              ? { ...data.pins }
              : Object.fromEntries(Object.entries(data.pins).filter(([, v]) => !pinId || v !== pinId));
            if (n.id === instanceId) {
              if (pinId) pins[portId] = pinId;
              else delete pins[portId];
            }
            return { ...n, data: { ...data, pins } };
          }),
        });
      },

      setRunning: (running) => set({ running }),

      clearAllPins: () => {
        set({
          nodes: get().nodes.map((n) => (n.type === 'module' ? { ...n, data: { ...(n.data as ModuleNodeData), pins: {} } } : n)),
        });
      },

      resetModules: () => {
        set({ nodes: get().nodes.filter((n) => n.type !== 'module') });
      },

      loadNodes: (nodes) => {
        // Papan wajib selalu ada — projek lama/rusak yang kehilangan node board tidak
        // boleh bikin kanvas kosong tanpa papan (semua pin jadi tak punya acuan).
        const hasBoard = nodes.some((n) => n.id === BOARD_NODE_ID);
        set({ nodes: hasBoard ? nodes : [BOARD_NODE, ...nodes] });
      },

      getModuleInstances: () => deriveModuleInstances(get().nodes),

      moduleIdByInstance: () => {
        const map = new Map<string, string>();
        for (const n of get().nodes) {
          if (n.type === 'module') map.set(n.id, (n.data as ModuleNodeData).moduleId);
        }
        return map;
      },
    }),
    {
      name: 'arduino-wokwi-clone-wiring',
      partialize: (state) => ({ nodes: state.nodes }),
    },
  ),
);
