import { BookOpen, Boxes, Code2, FolderOpen, Maximize2, Minimize2, Redo2, RotateCcw, Terminal, Undo2, ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import './App.css';
import { PartsPanel } from './canvas/PartsPanel';
import { useWiringStore } from './canvas/wiringStore';
import { Toolbar } from './components/Toolbar';
import { useSimulationStore } from './simulation/simulationStore';
import { CodeEditor, type CodeEditorHandle } from './editor/CodeEditor';
import { DEFAULT_SKETCH } from './editor/defaultSketch';
import { ExamplesDialog } from './editor/ExamplesDialog';
import { ProjectsDialog } from './projects/ProjectsDialog';
import { SerialMonitorPanel } from './serial/SerialMonitorPanel';
import { UploadConsole } from './upload/UploadConsole';

type MobileTab = 'code' | 'parts' | 'serial';

const MOBILE_TABS: { id: MobileTab; label: string; icon: typeof Code2 }[] = [
  { id: 'code', label: 'Kode', icon: Code2 },
  { id: 'parts', label: 'Komponen', icon: Boxes },
  { id: 'serial', label: 'Serial', icon: Terminal },
];

const EDITOR_WIDTH_KEY = 'arduino-wokwi-clone-editor-width';
const EDITOR_WIDTH_MIN = 280;
const EDITOR_WIDTH_DEFAULT = 480;

const FONT_SIZE_KEY = 'arduino-wokwi-clone-editor-font-size';
const FONT_SIZE_DEFAULT = 14;
const FONT_SIZE_MIN = 10;
const FONT_SIZE_MAX = 28;
const FONT_SIZE_STEP = 2;

/** Kode sketch terakhir. Rangkaian kanvas sudah diurus `persist` di wiringStore —
 * ini melengkapinya supaya refresh/tab ketutup tidak menghanguskan kerjaan siswa. */
const SOURCE_KEY = 'arduino-wokwi-clone-source';
/** Jeda sebelum menyimpan: hindari menulis localStorage di tiap ketikan. */
const SOURCE_SAVE_DEBOUNCE_MS = 500;

function readSavedEditorWidth(): number {
  const saved = Number(localStorage.getItem(EDITOR_WIDTH_KEY));
  return Number.isFinite(saved) && saved > 0 ? saved : EDITOR_WIDTH_DEFAULT;
}

function clampFontSize(size: number): number {
  return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, size));
}

function readSavedFontSize(): number {
  const saved = Number(localStorage.getItem(FONT_SIZE_KEY));
  return Number.isFinite(saved) && saved > 0 ? clampFontSize(saved) : FONT_SIZE_DEFAULT;
}

function readSavedSource(): string {
  try {
    return localStorage.getItem(SOURCE_KEY) ?? DEFAULT_SKETCH;
  } catch {
    return DEFAULT_SKETCH;
  }
}

/** Layout: editor kode di kiri, panel komponen (part + pilihan pin) di kanan, Serial Monitor di bawah.
 * Garis antara editor & panel komponen bisa digeser (drag) buat atur lebar; editor juga punya
 * tombol layar penuh sendiri. Di layar sempit/HP, ketiganya jadi tab layar-penuh lewat bilah tab. */
export default function App() {
  const [source, setSource] = useState(readSavedSource);
  const [mobileTab, setMobileTab] = useState<MobileTab>('code');
  const [editorFullscreen, setEditorFullscreen] = useState(false);
  const [editorWidth, setEditorWidth] = useState(readSavedEditorWidth);
  const [resizing, setResizing] = useState(false);
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [fontSize, setFontSize] = useState(readSavedFontSize);
  const bodyRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<CodeEditorHandle>(null);
  const nodes = useWiringStore((s) => s.nodes);
  const loadNodes = useWiringStore((s) => s.loadNodes);
  const errorLine = useSimulationStore((s) => s.errorLine);

  useEffect(() => {
    localStorage.setItem(EDITOR_WIDTH_KEY, String(editorWidth));
  }, [editorWidth]);

  useEffect(() => {
    localStorage.setItem(FONT_SIZE_KEY, String(fontSize));
  }, [fontSize]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(SOURCE_KEY, source);
      } catch {
        // Kuota penuh / mode privat — biarkan, jangan sampai mengganggu ketikan siswa.
      }
    }, SOURCE_SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [source]);

  const handleResizerPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setResizing(true);
  };

  const handleResizerPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!resizing || !bodyRef.current) return;
    const rect = bodyRef.current.getBoundingClientRect();
    const max = Math.max(EDITOR_WIDTH_MIN, rect.width - 320);
    setEditorWidth(Math.min(max, Math.max(EDITOR_WIDTH_MIN, e.clientX - rect.left)));
  };

  const handleResizerPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setResizing(false);
  };

  const handleZoomIn = () => setFontSize((size) => clampFontSize(size + FONT_SIZE_STEP));
  const handleZoomOut = () => setFontSize((size) => clampFontSize(size - FONT_SIZE_STEP));

  const handleReset = () => {
    if (source === DEFAULT_SKETCH) return;
    if (!window.confirm('Reset kode ke kerangka kosong? Kode yang sekarang akan hilang.')) return;
    setSource(DEFAULT_SKETCH);
  };

  const handlePickExample = (exampleSource: string) => {
    setSource(exampleSource);
    setMobileTab('code');
  };

  const handleOpenProject = (project: { source: string; nodes: typeof nodes }) => {
    setSource(project.source);
    loadNodes(project.nodes);
    setMobileTab('code');
  };

  const openExamples = () => {
    // Cuma tanya kalau ada kode yang benar-benar bisa hilang (bukan kerangka kosong).
    if (source.trim() !== DEFAULT_SKETCH.trim() && !window.confirm('Buka contoh? Kode yang sekarang akan diganti.')) return;
    setExamplesOpen(true);
  };

  return (
    <div className="app">
      <Toolbar source={source} />
      {!editorFullscreen && (
        <nav className="app__tabs">
          {MOBILE_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`app__tab${mobileTab === id ? ' app__tab--active' : ''}`}
              onClick={() => setMobileTab(id)}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>
      )}
      <div
        className={`app__body${editorFullscreen ? ' app__body--editor-fullscreen' : ''}`}
        data-mobile-tab={mobileTab}
        style={editorFullscreen ? undefined : { ['--editor-width' as string]: `${editorWidth}px` }}
        ref={bodyRef}
      >
        <div className="app__editor-pane">
          <div className="editor-toolbar">
            <span className="editor-toolbar__label">
              <Code2 size={13} /> sketch.ino
            </span>
            <div className="editor-toolbar__actions">
              <button
                type="button"
                className="editor-toolbar__btn"
                disabled={!canUndo}
                onClick={() => editorRef.current?.undo()}
                title="Undo (Ctrl+Z)"
                aria-label="Undo"
              >
                <Undo2 size={13} />
              </button>
              <button
                type="button"
                className="editor-toolbar__btn"
                disabled={!canRedo}
                onClick={() => editorRef.current?.redo()}
                title="Redo (Ctrl+Y)"
                aria-label="Redo"
              >
                <Redo2 size={13} />
              </button>
              <button
                type="button"
                className="editor-toolbar__btn"
                disabled={fontSize <= FONT_SIZE_MIN}
                onClick={handleZoomOut}
                title="Perkecil font"
                aria-label="Perkecil font"
              >
                <ZoomOut size={13} />
              </button>
              <button
                type="button"
                className="editor-toolbar__btn"
                disabled={fontSize >= FONT_SIZE_MAX}
                onClick={handleZoomIn}
                title="Perbesar font"
                aria-label="Perbesar font"
              >
                <ZoomIn size={13} />
              </button>
              <button type="button" className="editor-toolbar__btn" onClick={() => setProjectsOpen(true)} title="Projek saya (simpan / buka / unduh .ino)">
                <FolderOpen size={13} />
              </button>
              <button type="button" className="editor-toolbar__btn" onClick={openExamples} title="Buka contoh sketch">
                <BookOpen size={13} />
              </button>
              <button type="button" className="editor-toolbar__btn" onClick={handleReset} title="Reset ke kerangka kosong">
                <RotateCcw size={13} />
              </button>
              <button
                type="button"
                className="editor-toolbar__btn"
                onClick={() => setEditorFullscreen((f) => !f)}
                title={editorFullscreen ? 'Keluar layar penuh' : 'Layar penuh'}
              >
                {editorFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
            </div>
          </div>
          <div className="app__editor-body">
            <CodeEditor
              ref={editorRef}
              value={source}
              onChange={setSource}
              errorLine={errorLine}
              fontSize={fontSize}
              onHistoryChange={({ canUndo, canRedo }) => {
                setCanUndo(canUndo);
                setCanRedo(canRedo);
              }}
            />
          </div>
        </div>

        {!editorFullscreen && (
          <div
            className={`app__resizer${resizing ? ' app__resizer--active' : ''}`}
            onPointerDown={handleResizerPointerDown}
            onPointerMove={handleResizerPointerMove}
            onPointerUp={handleResizerPointerUp}
            role="separator"
            aria-orientation="vertical"
            aria-label="Atur lebar editor"
          />
        )}

        <main className="app__sim-pane">
          <PartsPanel />
        </main>
        <div className="app__bottom">
          <SerialMonitorPanel />
        </div>
      </div>
      <UploadConsole />
      <ExamplesDialog open={examplesOpen} onClose={() => setExamplesOpen(false)} onPick={handlePickExample} />
      <ProjectsDialog
        open={projectsOpen}
        onClose={() => setProjectsOpen(false)}
        currentSource={source}
        currentNodes={nodes}
        onOpenProject={handleOpenProject}
        onImportSource={(imported) => {
          setSource(imported);
          setMobileTab('code');
        }}
      />
    </div>
  );
}
