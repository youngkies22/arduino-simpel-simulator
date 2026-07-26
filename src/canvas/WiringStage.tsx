import { Background, Controls, ReactFlow, useReactFlow, type Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useEffect, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/shallow';
import { BoardCanvasNode } from './BoardCanvasNode';
import { ModuleCanvasNode } from './ModuleCanvasNode';
import { BOARD_NODE_ID, useWiringStore, type ModuleNodeData } from './wiringStore';
import { useSimulationStore } from '../simulation/simulationStore';
import { useBoardStore } from '../upload/boardStore';

const NODE_TYPES = { board: BoardCanvasNode, module: ModuleCanvasNode };

function buildEdges(nodes: ReturnType<typeof useWiringStore.getState>['nodes'], animated: boolean): Edge[] {
  const edges: Edge[] = [];
  for (const n of nodes) {
    if (n.type !== 'module') continue;
    const data = n.data as ModuleNodeData;
    for (const [portId, pinId] of Object.entries(data.pins)) {
      if (!pinId) continue;
      edges.push({
        id: `${n.id}:${portId}`,
        source: BOARD_NODE_ID,
        sourceHandle: `pin:${pinId}`,
        target: n.id,
        targetHandle: `port:${portId}`,
        className: 'wiring-edge',
        animated,
        focusable: false,
        selectable: false,
        deletable: false,
      });
    }
  }
  return edges;
}

/**
 * Panggung wiring: papan Arduino + kartu part, keduanya node React Flow yang bisa
 * digeser bebas (drag) dan kanvasnya bisa di-pan/zoom — persis gaya kanvas sebelumnya.
 * Bedanya: sambungan pin TIDAK dibuat dengan menarik kabel. Kabel (edge) di sini murni
 * hasil turunan dari `instance.pins` (dipilih lewat <select> di tiap kartu), jadi
 * `nodesConnectable` dimatikan total — tidak ada cara membuat/mengubah sambungan selain
 * lewat dropdown pin di kartu.
 *
 * Sengaja TIDAK membungkus diri sendiri dengan <ReactFlowProvider> (beda dari sebelumnya)
 * — providernya sekarang di PartsPanel (parent), supaya tombol "Tambah part" di situ juga
 * bisa akses useReactFlow() buat tahu area kanvas yang sedang terlihat (lihat komentar di
 * PartsPanel.tsx soal kenapa ini penting).
 */
export function WiringStage() {
  const { nodes, onNodesChange } = useWiringStore(useShallow((s) => ({ nodes: s.nodes, onNodesChange: s.onNodesChange })));
  const running = useSimulationStore((s) => s.status === 'running');
  const edges = useMemo(() => buildEdges(nodes, running), [nodes, running]);
  const isEmpty = nodes.every((n) => n.type !== 'module');

  const wrapperRef = useRef<HTMLDivElement>(null);
  const hasFittedOnce = useRef(false);
  const reactFlow = useReactFlow();
  const boardId = useBoardStore((s) => s.boardId);

  // Di tab HP, panel ini di-render tersembunyi (display:none, ukuran 0) sampai user
  // membuka tab "Komponen" — `fitView` di mount saja akan gagal karena kanvasnya
  // masih 0x0 saat itu. ResizeObserver ini menunggu ukuran nyata PERTAMA kali muncul
  // (baik langsung di desktop maupun setelah tab dibuka di HP) baru fitView sekali.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (!hasFittedOnce.current && width > 0 && height > 0) {
        hasFittedOnce.current = true;
        reactFlow.fitView({ padding: 0.35, maxZoom: 1 });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [reactFlow]);

  // Board lain lebar/jumlah pin-nya beda jauh (ESP32 pin-nya jauh lebih banyak dari Uno)
  // -- tanpa ini, papan yang baru dipilih bisa terpotong di tepi kanvas sampai user
  // zoom/pan manual. Di-skip pada fit PERTAMA (sudah ditangani ResizeObserver di atas).
  // Delay singkat WAJIB ada: React Flow mengukur dimensi node lewat ResizeObserver-nya
  // sendiri secara async, jadi fitView yang dipanggil di render yang sama masih memakai
  // ukuran papan LAMA (sebelum DOM sempat re-render dgn pin board baru).
  useEffect(() => {
    if (!hasFittedOnce.current) return;
    const timer = setTimeout(() => reactFlow.fitView({ padding: 0.35, maxZoom: 1 }), 60);
    return () => clearTimeout(timer);
  }, [boardId, reactFlow]);

  return (
    <div className="wiring-stage" ref={wrapperRef}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        nodeTypes={NODE_TYPES}
        nodesConnectable={false}
        nodesDraggable={!running}
        elementsSelectable={!running}
        edgesFocusable={false}
        deleteKeyCode={null}
        minZoom={0.35}
        maxZoom={1.75}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={22} size={1.6} color="var(--text-faint)" />
        <Controls showInteractive={false} />
      </ReactFlow>
      {isEmpty && (
        <p className="wiring-stage__empty">
          Belum ada komponen. Tekan &quot;Tambah part&quot;, lalu pilih pin — kabelnya otomatis tersambung ke board.
          Geser papan atau kartu part untuk menata ulang kanvas.
        </p>
      )}
    </div>
  );
}
