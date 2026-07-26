import { Eraser } from 'lucide-react';
import { useState } from 'react';
import { SerialPlotter } from './SerialPlotter';
import { useSerialStore } from './serialStore';

type SerialTab = 'monitor' | 'plotter';

/** Panel Serial: tab Monitor (log teks + kirim input) dan Plotter (grafik angka). */
export function SerialMonitorPanel() {
  const buffer = useSerialStore((s) => s.buffer);
  const baud = useSerialStore((s) => s.baud);
  const sendInput = useSerialStore((s) => s.sendInput);
  const showSystemMessages = useSerialStore((s) => s.showSystemMessages);
  const setShowSystemMessages = useSerialStore((s) => s.setShowSystemMessages);
  const clearBuffer = useSerialStore((s) => s.clearBuffer);
  const plotSamples = useSerialStore((s) => s.plotSamples);
  const [draft, setDraft] = useState('');
  const [tab, setTab] = useState<SerialTab>('monitor');

  const handleSend = () => {
    if (draft.length === 0) return;
    sendInput(draft + '\n');
    setDraft('');
  };

  const isMonitor = tab === 'monitor';

  return (
    <div className="serial-monitor">
      <div className="serial-monitor__header">
        <div className="serial-monitor__tabs">
          <button
            type="button"
            className={`serial-monitor__tab${isMonitor ? ' serial-monitor__tab--active' : ''}`}
            onClick={() => setTab('monitor')}
          >
            Monitor
          </button>
          <button
            type="button"
            className={`serial-monitor__tab${!isMonitor ? ' serial-monitor__tab--active' : ''}`}
            onClick={() => setTab('plotter')}
          >
            Plotter
            {plotSamples.length > 0 && <span className="serial-monitor__tab-badge">{plotSamples.length}</span>}
          </button>
        </div>
        {isMonitor && (
          <label className="serial-monitor__system-toggle">
            <input type="checkbox" checked={showSystemMessages} onChange={(e) => setShowSystemMessages(e.target.checked)} />
            Pesan sistem
          </label>
        )}
        <span className="serial-monitor__baud">{baud} baud</span>
        <button
          type="button"
          className="serial-monitor__clear"
          onClick={clearBuffer}
          disabled={buffer.length === 0 && plotSamples.length === 0}
          title="Bersihkan log Serial Monitor dan data plotter"
        >
          <Eraser size={13} /> Clear
        </button>
      </div>

      {isMonitor ? (
        <>
          <pre className="serial-monitor__log">{buffer}</pre>
          <div className="serial-monitor__input">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Kirim ke Serial..."
            />
            <button type="button" onClick={handleSend}>
              Kirim
            </button>
          </div>
        </>
      ) : (
        <SerialPlotter samples={plotSamples} />
      )}
    </div>
  );
}
