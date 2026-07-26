import { Cpu, Download, Moon, Play, Settings, Square, Sun, Trash2, Upload, User } from 'lucide-react';
import { useState } from 'react';
import { StatusPill } from './StatusPill';
import { ProfileDialog } from './ProfileDialog';
import { SettingsDialog } from './SettingsDialog';
import type { BoardId } from '../boardId';
import { useWiringStore } from '../canvas/wiringStore';
import { useSimulationStore } from '../simulation/simulationStore';
import { useThemeStore } from '../theme/themeStore';
import { BOARD_OPTIONS, boardById, useBoardStore } from '../upload/boardStore';
import { compileSketch } from '../upload/compileClient';
import { downloadCompileResult, flashInstructionsFor } from '../upload/downloadCompiled';
import { isWebSerialSupported, uploadSketchToBoard } from '../upload/flashArduino';
import { uploadSketchToEspBoard } from '../upload/flashEsp';
import { useUploadStore } from '../upload/uploadStore';

interface ToolbarProps {
  source: string;
}

// Dukungan browser tidak berubah selama app jalan — cukup dicek sekali di luar komponen.
const webSerialSupported = isWebSerialSupported();

/** Toolbar atas: brand + pilih board + tombol Start/Stop Simulation + Upload/Unduh + status. */
export function Toolbar({ source }: ToolbarProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const boardId = useBoardStore((s) => s.boardId);
  const setBoardId = useBoardStore((s) => s.setBoardId);
  const moduleCount = useWiringStore((s) => s.nodes.filter((n) => n.type === 'module').length);
  const resetModules = useWiringStore((s) => s.resetModules);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const status = useSimulationStore((s) => s.status);
  const errorMessage = useSimulationStore((s) => s.errorMessage);
  const run = useSimulationStore((s) => s.run);
  const stop = useSimulationStore((s) => s.stop);

  const uploadPhase = useUploadStore((s) => s.phase);
  const startUpload = useUploadStore((s) => s.start);
  const appendLine = useUploadStore((s) => s.appendLine);
  const setProgress = useUploadStore((s) => s.setProgress);
  const finishUpload = useUploadStore((s) => s.finish);

  const running = status === 'running';
  const uploading = uploadPhase === 'running';
  const board = boardById(boardId);

  const handleUpload = async () => {
    startUpload(`Upload ke ${board.label}`);
    try {
      if (board.kind === 'avr') {
        await uploadSketchToBoard(source, {
          onLog: (line) => appendLine(line),
          onProgress: ({ phase, pageIndex, totalPages }) =>
            setProgress({ phase, percent: Math.round((pageIndex / totalPages) * 100) }),
        });
      } else {
        // ESP32/ESP8266: board TIDAK direset otomatis (beda dari AVR) — pesan penuntun
        // "tekan tombol BOOT/FLASH" muncul di log lewat onLog di flashEsp.ts.
        await uploadSketchToEspBoard(source, board.fqbn, board.id === 'esp32' ? 'esp32' : 'esp8266', {
          onLog: (line) => appendLine(line),
          onProgress: ({ blockIndex, totalBlocks }) => setProgress({ phase: 'write', percent: Math.round((blockIndex / totalBlocks) * 100) }),
        });
      }
      finishUpload('success', 'Upload selesai — sketch sudah berjalan di board.');
    } catch (err) {
      finishUpload('error', `Gagal: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleResetModules = () => {
    if (moduleCount === 0) return;
    if (!window.confirm(`Hapus semua ${moduleCount} komponen dari kanvas? Board tidak ikut terhapus. Tindakan ini tidak bisa dibatalkan.`)) return;
    resetModules();
  };

  // Cadangan untuk ESP32/ESP8266 kalau upload lewat Web Serial gagal (mis. driver USB
  // bermasalah) — cuma compile lalu unduh .bin, siswa flash manual pakai esptool dkk.
  const handleCompileAndDownload = async () => {
    startUpload('Compile & Unduh .bin');
    appendLine(`Mengompilasi untuk ${board.label}...`);
    try {
      const result = await compileSketch(source, board.fqbn);
      if (result.log) for (const line of result.log.split('\n')) if (line.trim()) appendLine(line);
      if (!result.ok) throw new Error(result.error ?? 'Kompilasi gagal.');

      downloadCompileResult(board.label, result);

      const instructions = flashInstructionsFor(result, board.id === 'esp32' ? 'esp32' : 'esp8266');
      appendLine('File .bin terunduh.');
      if (instructions) {
        appendLine('Flash manual dengan esptool (ganti nama file sesuai yang terunduh):');
        appendLine(instructions);
      }
      finishUpload('success', 'Selesai — cek folder unduhan.');
    } catch (err) {
      finishUpload('error', `Gagal: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <header className="toolbar">
      <span className="toolbar__brand">
        <Cpu size={18} />
        <span className="toolbar__brand-text">Arduino Simulator</span>
      </span>
      <button
        type="button"
        className="toolbar__profile"
        onClick={() => setProfileOpen(true)}
        title="Info pengembang"
        aria-label="Info pengembang"
      >
        <User size={16} />
      </button>
      <select
        className="toolbar__board"
        value={boardId}
        onChange={(e) => setBoardId(e.target.value as BoardId)}
        disabled={running || uploading}
        title="Board tujuan compile & upload"
        aria-label="Pilih board"
      >
        {BOARD_OPTIONS.map((b) => (
          <option key={b.id} value={b.id}>
            {b.label}
          </option>
        ))}
      </select>
      <div className="toolbar__actions">
        <button type="button" className="toolbar__run" disabled={running || uploading} onClick={() => run(source)}>
          <Play size={14} /> Mulai
        </button>
        <button type="button" className="toolbar__stop" disabled={!running} onClick={stop}>
          <Square size={14} /> Stop
        </button>
        <button
          type="button"
          className="toolbar__reset-modules"
          disabled={running || uploading || moduleCount === 0}
          onClick={handleResetModules}
          title="Hapus semua part dari kanvas (board tidak ikut terhapus)"
          aria-label="Reset Komponen"
        >
          <Trash2 size={14} /> <span className="toolbar__reset-label">Reset Komponen</span>
        </button>
        {webSerialSupported ? (
          <button
            type="button"
            className="toolbar__upload"
            disabled={running || uploading}
            onClick={handleUpload}
            title={
              board.kind === 'avr'
                ? 'Compile lalu upload sketch ini ke Arduino asli lewat USB'
                : `Compile lalu upload ke ${board.label} lewat USB — pastikan board di mode download (tombol BOOT/FLASH) dulu`
            }
            aria-label={uploading ? 'Meng-upload...' : 'Upload ke Board'}
          >
            <Upload size={14} /> <span className="toolbar__upload-label">{uploading ? 'Meng-upload...' : 'Upload ke Board'}</span>
          </button>
        ) : (
          <span
            className="toolbar__upload-unsupported"
            title="Upload ke board fisik cuma didukung Chrome/Edge di PC — Web Serial API belum ada di browser ini (termasuk semua browser HP)"
            aria-label="Upload ke board fisik cuma didukung Chrome/Edge di PC"
          >
            <Upload size={14} /> <span className="toolbar__upload-label">Upload (Chrome/Edge PC)</span>
          </span>
        )}
        {board.kind === 'esp' && (
          <button
            type="button"
            className="toolbar__download-bin"
            disabled={running || uploading}
            onClick={handleCompileAndDownload}
            title="Cadangan: compile lalu unduh file .bin buat di-flash manual (esptool dkk), kalau Upload ke Board gagal"
            aria-label="Compile & Unduh .bin"
          >
            <Download size={14} />
          </button>
        )}
        <button
          type="button"
          className="toolbar__settings"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Ganti ke tema terang' : 'Ganti ke tema gelap'}
          aria-label={theme === 'dark' ? 'Ganti ke tema terang' : 'Ganti ke tema gelap'}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button
          type="button"
          className="toolbar__settings"
          onClick={() => setSettingsOpen(true)}
          title="Pengaturan (alamat compile server)"
          aria-label="Pengaturan"
        >
          <Settings size={16} />
        </button>
        <StatusPill status={status} />
      </div>
      {errorMessage && <span className="toolbar__error">{errorMessage}</span>}
      <ProfileDialog open={profileOpen} onClose={() => setProfileOpen(false)} />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </header>
  );
}
