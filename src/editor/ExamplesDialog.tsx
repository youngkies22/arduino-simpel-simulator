import { BookOpen, X } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { SKETCH_EXAMPLES, fetchExampleSource } from './examples';

interface ExamplesDialogProps {
  open: boolean;
  onClose: () => void;
  /** Dipanggil dengan isi sketch setelah contoh berhasil diambil. */
  onPick: (source: string) => void;
}

/** Daftar contoh sketch siap pakai. Di-render lewat portal ke document.body supaya
 * selalu di atas kanvas React Flow yang ber-transform (sama seperti UploadConsole). */
export function ExamplesDialog({ open, onClose, onPick }: ExamplesDialogProps) {
  const [loadingFile, setLoadingFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const pick = async (file: string) => {
    setLoadingFile(file);
    setError(null);
    try {
      onPick(await fetchExampleSource(file));
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingFile(null);
    }
  };

  return createPortal(
    <div className="examples-overlay" onClick={onClose}>
      <div className="examples" onClick={(e) => e.stopPropagation()}>
        <header className="examples__header">
          <span className="examples__title">
            <BookOpen size={16} /> Contoh Sketch
          </span>
          <button type="button" className="examples__close" onClick={onClose} aria-label="Tutup">
            <X size={16} />
          </button>
        </header>

        <p className="examples__hint">Urut dari paling dasar ke paling kompleks — bisa dipakai sebagai urutan materi.</p>

        {error && <p className="examples__error">{error}</p>}

        <ul className="examples__list">
          {SKETCH_EXAMPLES.map(({ file, title, description }) => (
            <li key={file}>
              <button type="button" className="examples__item" onClick={() => pick(file)} disabled={loadingFile !== null}>
                <span className="examples__item-title">{title}</span>
                <span className="examples__item-desc">{description}</span>
                {loadingFile === file && <span className="examples__item-loading">Memuat...</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
