import { Handle, Position } from '@xyflow/react';
import { useMemo } from 'react';
import { pinsForBoard, type BoardId, type PhysicalPin } from './boardPinLayout';
import { useWiringStore, type ModuleNodeData } from './wiringStore';
import { getModuleDefinition } from '../modules/registry';
import { useBoardStore } from '../upload/boardStore';

interface BoardChrome {
  className: string;
  chip: string;
  brandTitle: string;
  brandSub: string;
}

const BOARD_CHROME: Record<BoardId, BoardChrome> = {
  uno: { className: 'board', chip: 'ATmega328P', brandTitle: 'ARDUINO', brandSub: 'UNO R3' },
  esp32: { className: 'board board--esp32', chip: 'ESP32-WROOM-32', brandTitle: 'ESP32', brandSub: 'DEV MODULE' },
  esp8266: { className: 'board board--esp8266', chip: 'ESP8266 (ESP-12E)', brandTitle: 'NodeMCU', brandSub: 'V1.0' },
};

function splitRows(pins: PhysicalPin[]): { top: PhysicalPin[]; bottom: PhysicalPin[] } {
  // Digital/GPIO di baris atas, sisanya (analog, power, ground) di bawah — sama pembagian
  // yang dipakai layout Uno sebelumnya, cukup umum buat board dua-baris manapun.
  const top = pins.filter((p) => p.id.startsWith('D') || p.id.startsWith('GPIO'));
  const bottom = pins.filter((p) => !top.includes(p));
  return { top, bottom };
}

/** Selector zustand harus mengembalikan referensi stabil — Map baru dibangun lewat
 * useMemo (bukan langsung di dalam selector) supaya tidak memicu render loop.
 * Nilainya array (bukan satu judul) karena pin ground/power boleh dipakai banyak modul
 * sekaligus (rel bersama), jadi satu pin bisa disambungi lebih dari satu part. */
function useConnectedPinTitles(): Map<string, string[]> {
  const nodes = useWiringStore((s) => s.nodes);
  return useMemo(() => {
    const map = new Map<string, string[]>();
    for (const n of nodes) {
      if (n.type !== 'module') continue;
      const data = n.data as ModuleNodeData;
      const title = getModuleDefinition(data.moduleId)?.title ?? data.moduleId;
      for (const pinId of Object.values(data.pins)) {
        if (!pinId) continue;
        const list = map.get(pinId) ?? [];
        list.push(title);
        map.set(pinId, list);
      }
    }
    return map;
  }, [nodes]);
}

/**
 * Node React Flow untuk papan board aktif (Arduino Uno / ESP32 / ESP8266, dipilih di
 * dropdown Toolbar) — bisa digeser bebas seperti part lain, tapi tidak bisa dihapus.
 * Pin-nya adalah <Handle> non-connectable (isConnectable=false): cuma jadi titik ujung
 * kabel visual yang otomatis muncul begitu user memilih pin lewat <select> di kartu part
 * — bukan tempat menarik kabel baru.
 */
export function BoardCanvasNode() {
  const connected = useConnectedPinTitles();
  const boardId = useBoardStore((s) => s.boardId);
  const chrome = BOARD_CHROME[boardId];
  const { top, bottom } = useMemo(() => splitRows(pinsForBoard(boardId)), [boardId]);

  return (
    <div className={chrome.className}>
      <div className="board__row board__row--top">
        {top.map((pin) => {
          const titles = connected.get(pin.id);
          return (
            <div key={pin.id} className="board__pin" title={titles ? `${pin.label} → ${titles.join(', ')}` : pin.label}>
              <Handle
                type="source"
                position={Position.Top}
                id={`pin:${pin.id}`}
                isConnectable={false}
                className={`wire-dot${titles ? ' wire-dot--active' : ''}`}
              />
              <span className="board__pin-label">{pin.id}</span>
            </div>
          );
        })}
      </div>

      <div className="board__center">
        <div className="board__chip">{chrome.chip}</div>
        <div className="board__brand">
          <span className="board__brand-title">{chrome.brandTitle}</span>
          <span className="board__brand-sub">{chrome.brandSub}</span>
        </div>
        <div className="board__deco">
          <span className="board__usb" title="USB" />
          <span className="board__led" title="Power" />
        </div>
      </div>

      <div className="board__row board__row--bottom">
        {bottom.map((pin) => {
          const titles = connected.get(pin.id);
          return (
            <div key={pin.id} className="board__pin" title={titles ? `${pin.label} → ${titles.join(', ')}` : pin.label}>
              <span className="board__pin-label">{pin.label}</span>
              <Handle
                type="source"
                position={Position.Bottom}
                id={`pin:${pin.id}`}
                isConnectable={false}
                className={`wire-dot${titles ? ' wire-dot--active' : ''}`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
