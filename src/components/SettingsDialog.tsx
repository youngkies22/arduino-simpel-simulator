import { Settings, X } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { defaultCompileServerUrl, setCompileServerUrl, storedCompileServerUrl } from '../upload/compileServerSetting';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

/** Pengaturan yang disimpan di browser masing-masing (bukan di build), supaya ganti
 * alamat compile-server tidak perlu build & deploy ulang. */
export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const [url, setUrl] = useState(() => storedCompileServerUrl() ?? '');
  const [saved, setSaved] = useState(false);

  if (!open) return null;

  const save = () => {
    setCompileServerUrl(url);
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  const reset = () => {
    setCompileServerUrl('');
    setUrl('');
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  return createPortal(
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings" onClick={(e) => e.stopPropagation()}>
        <header className="settings__header">
          <span className="settings__title">
            <Settings size={16} /> Pengaturan
          </span>
          <button type="button" className="settings__close" onClick={onClose} aria-label="Tutup">
            <X size={16} />
          </button>
        </header>

        <div className="settings__body">
          <label className="settings__label" htmlFor="compile-server-url">
            Alamat compile server
          </label>
          <input
            id="compile-server-url"
            className="settings__input"
            type="url"
            inputMode="url"
            placeholder={defaultCompileServerUrl()}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            spellCheck={false}
          />
          <p className="settings__help">
            Server yang mengompilasi sketch jadi file <code>.hex</code> sebelum di-upload ke board asli. Kosongkan untuk memakai
            bawaan (<code>{defaultCompileServerUrl()}</code>). Setelan ini cuma berlaku di browser ini.
          </p>
        </div>

        <footer className="settings__footer">
          {saved && <span className="settings__saved">Tersimpan</span>}
          <button type="button" className="settings__reset" onClick={reset}>
            Kembalikan default
          </button>
          <button type="button" className="settings__save" onClick={save}>
            Simpan
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
