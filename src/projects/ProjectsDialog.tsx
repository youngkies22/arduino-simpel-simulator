import { Download, FolderOpen, Save, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Node } from '@xyflow/react';
import { MAX_PROJECTS, deleteProject, downloadSketch, listProjects, saveProject, type SavedProject } from './projectStore';

interface ProjectsDialogProps {
  open: boolean;
  onClose: () => void;
  /** Kode & rangkaian yang sedang dikerjakan — dipakai saat menyimpan. */
  currentSource: string;
  currentNodes: Node[];
  /** Dipanggil saat user membuka projek tersimpan. */
  onOpenProject: (project: SavedProject) => void;
  /** Dipanggil saat user mengimpor file .ino dari disk (kode saja, rangkaian tidak diubah). */
  onImportSource: (source: string) => void;
}

function formatDate(epochMs: number): string {
  return new Date(epochMs).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Manajer projek: simpan kerjaan sekarang, buka lagi projek lama, unduh .ino, hapus.
 * Semuanya di browser (localStorage) — tidak perlu akun atau server. */
export function ProjectsDialog({
  open,
  onClose,
  currentSource,
  currentNodes,
  onOpenProject,
  onImportSource,
}: ProjectsDialogProps) {
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dibaca ulang tiap kali dialog dibuka (bukan sekali saat mount) supaya daftarnya tetap
  // benar kalau projek diubah dari tab lain, dan pesan lama tidak nyangkut.
  useEffect(() => {
    if (!open) return;
    setProjects(listProjects());
    setError(null);
    setNotice(null);
  }, [open]);

  if (!open) return null;

  const refresh = () => setProjects(listProjects());

  const handleSave = () => {
    setError(null);
    try {
      const saved = saveProject(name, currentSource, currentNodes);
      refresh();
      setName('');
      setNotice(`Tersimpan sebagai "${saved.name}".`);
      setTimeout(() => setNotice(null), 2200);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleDelete = (project: SavedProject) => {
    if (!window.confirm(`Hapus projek "${project.name}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    deleteProject(project.id);
    refresh();
  };

  const handleImport = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const text = await file.text();
      if (!window.confirm(`Impor "${file.name}"? Kode yang sekarang akan diganti.`)) return;
      onImportSource(text);
      // Isi nama otomatis dari nama file supaya tinggal tekan Simpan.
      setName(file.name.replace(/\.ino$/i, ''));
      setNotice(`"${file.name}" dimuat ke editor. Tekan Simpan kalau mau disimpan sebagai projek.`);
      setTimeout(() => setNotice(null), 3200);
    } catch (e) {
      setError(`Gagal membaca file: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      // Reset supaya memilih file yang SAMA dua kali tetap memicu onChange.
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleOpen = (project: SavedProject) => {
    if (!window.confirm(`Buka "${project.name}"? Kode & rangkaian yang sekarang akan diganti.`)) return;
    onOpenProject(project);
    onClose();
  };

  const sorted = [...projects].sort((a, b) => b.savedAt - a.savedAt);
  const full = projects.length >= MAX_PROJECTS;

  return createPortal(
    <div className="projects-overlay" onClick={onClose}>
      <div className="projects" onClick={(e) => e.stopPropagation()}>
        <header className="projects__header">
          <span className="projects__title">
            <FolderOpen size={16} /> Projek Saya
          </span>
          <span className="projects__count">
            {projects.length} / {MAX_PROJECTS}
          </span>
          <button type="button" className="projects__close" onClick={onClose} aria-label="Tutup">
            <X size={16} />
          </button>
        </header>

        <div className="projects__save">
          <input
            className="projects__input"
            type="text"
            placeholder="Nama projek (mis. Lampu Lalu Lintas)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && name.trim() && handleSave()}
            maxLength={60}
          />
          <button type="button" className="projects__save-btn" onClick={handleSave} disabled={!name.trim()}>
            <Save size={14} /> Simpan
          </button>
          <button
            type="button"
            className="projects__download-btn"
            onClick={() => downloadSketch(name.trim() || 'sketch', currentSource)}
            title="Unduh kode yang sekarang sebagai file .ino"
          >
            <Download size={14} /> Unduh .ino
          </button>
          <button
            type="button"
            className="projects__download-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Buka file .ino dari komputer ini"
          >
            <Upload size={14} /> Impor .ino
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".ino,.txt,.c,.cpp,text/plain"
            hidden
            onChange={(e) => void handleImport(e.target.files?.[0])}
          />
        </div>

        {error && <p className="projects__error">{error}</p>}
        {notice && <p className="projects__notice">{notice}</p>}
        {full && !error && <p className="projects__warning">Penyimpanan penuh. Hapus projek lama untuk menyimpan yang baru.</p>}

        {sorted.length === 0 ? (
          <p className="projects__empty">
            Belum ada projek tersimpan. Ketik nama di atas lalu tekan <strong>Simpan</strong> — kode dan rangkaian kanvas
            ikut tersimpan.
          </p>
        ) : (
          <ul className="projects__list">
            {sorted.map((project) => (
              <li key={project.id} className="projects__item">
                <button type="button" className="projects__item-main" onClick={() => handleOpen(project)}>
                  <span className="projects__item-name">{project.name}</span>
                  <span className="projects__item-meta">{formatDate(project.savedAt)}</span>
                </button>
                <button
                  type="button"
                  className="projects__item-btn"
                  onClick={() => downloadSketch(project.name, project.source)}
                  title="Unduh sebagai .ino"
                  aria-label={`Unduh ${project.name}`}
                >
                  <Download size={14} />
                </button>
                <button
                  type="button"
                  className="projects__item-btn projects__item-btn--danger"
                  onClick={() => handleDelete(project)}
                  title="Hapus projek"
                  aria-label={`Hapus ${project.name}`}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>,
    document.body,
  );
}
