import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useUploadStore } from './uploadStore';

const PHASE_LABEL: Record<'running' | 'success' | 'error', string> = {
  running: 'Berjalan...',
  success: 'Berhasil',
  error: 'Gagal',
};

/** Panel "Upload ke Board" gaya konsol Arduino IDE: log baris-per-baris yang auto-scroll +
 * progress bar saat menulis/verifikasi halaman flash. Di-render lewat portal ke
 * document.body supaya selalu di atas apapun (termasuk kanvas React Flow yang ber-transform). */
export function UploadConsole() {
  const open = useUploadStore((s) => s.open);
  const title = useUploadStore((s) => s.title);
  const phase = useUploadStore((s) => s.phase);
  const lines = useUploadStore((s) => s.lines);
  const progress = useUploadStore((s) => s.progress);
  const close = useUploadStore((s) => s.close);
  const logRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [lines]);

  if (!open) return null;

  const running = phase === 'running';

  return createPortal(
    <div className="upload-console-overlay" onClick={() => !running && close()}>
      <div className="upload-console" onClick={(e) => e.stopPropagation()}>
        <header className="upload-console__header">
          <span className="upload-console__title">
            {title}
            {phase !== 'idle' && <span className={`upload-console__badge upload-console__badge--${phase}`}>{PHASE_LABEL[phase]}</span>}
          </span>
          <button type="button" className="upload-console__close" onClick={close} disabled={running} aria-label="Tutup">
            <X size={16} />
          </button>
        </header>

        {progress && (
          <div className="upload-console__progress">
            <div className="upload-console__progress-label">
              {progress.phase === 'write' ? 'Menulis flash' : 'Memverifikasi'} — {progress.percent}%
            </div>
            <div className="upload-console__progress-track">
              <div className="upload-console__progress-bar" style={{ width: `${progress.percent}%` }} />
            </div>
          </div>
        )}

        <pre className="upload-console__log" ref={logRef}>
          {lines.join('\n')}
        </pre>
      </div>
    </div>,
    document.body,
  );
}
