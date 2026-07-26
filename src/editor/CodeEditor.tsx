import { autocompletion } from '@codemirror/autocomplete';
import { redo as cmRedo, undo as cmUndo, redoDepth, undoDepth } from '@codemirror/commands';
import { cpp } from '@codemirror/lang-cpp';
import { StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { arduinoCompletionSource } from './arduinoCompletions';
import { useThemeStore } from '../theme/themeStore';

/** Efek untuk menandai baris yang error (null = bersihkan tanda). */
const setErrorLine = StateEffect.define<number | null>();

const errorLineDecoration = Decoration.line({ class: 'cm-error-line' });

/** Menyimpan dekorasi baris error di dalam state editor, supaya posisinya ikut
 * menyesuaikan saat siswa mengetik (bukan koordinat mati). */
const errorLineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, tr) {
    let next = decorations.map(tr.changes);
    for (const effect of tr.effects) {
      if (!effect.is(setErrorLine)) continue;
      const line = effect.value;
      if (line === null || line < 1 || line > tr.state.doc.lines) {
        next = Decoration.none;
      } else {
        next = Decoration.set([errorLineDecoration.range(tr.state.doc.line(line).from)]);
      }
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

// EditorView.lineWrapping: baris panjang dibungkus (bukan digulir horizontal) — di HP,
// gestur geser-kiri/kanan buat scroll horizontal di dalam CodeMirror suka bentrok dengan
// gestur navigasi browser (misal edge-swipe-back Safari), jadi baris kadang "tidak mau
// digeser". Line wrapping menghilangkan kebutuhan scroll horizontal itu sama sekali.
const BASE_EXTENSIONS = [
  cpp(),
  EditorView.lineWrapping,
  errorLineField,
  autocompletion({
    override: [arduinoCompletionSource],
    // Ikon tipe di daftar saran tidak berguna buat siswa pemula, teks detail lebih jelas.
    icons: false,
    activateOnTyping: true,
  }),
];

export interface CodeEditorHandle {
  undo: () => void;
  redo: () => void;
}

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  /** Baris yang error (1-based) — disorot dan digulir ke tampilan. */
  errorLine?: number;
  /** Ukuran font kode dalam px (siswa atur lewat tombol A-/A+ di toolbar). */
  fontSize: number;
  /** Dipanggil tiap kali status undo/redo berubah, buat mengaktif/nonaktifkan tombol di toolbar. */
  onHistoryChange?: (state: { canUndo: boolean; canRedo: boolean }) => void;
}

/** Editor kode sketch Arduino — CodeMirror 6 dengan syntax highlight C/C++, selalu bisa diedit (gaya Wokwi). */
export const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(function CodeEditor(
  { value, onChange, readOnly, errorLine, fontSize, onHistoryChange },
  handleRef,
) {
  const ref = useRef<ReactCodeMirrorRef>(null);
  const theme = useThemeStore((s) => s.theme);

  // Ref, bukan dependency array — biar array `extensions` di bawah tidak dibuat ulang gara-gara
  // ganti callback (recreate memicu react-codemirror mengonfigurasi ulang editor).
  const onHistoryChangeRef = useRef(onHistoryChange);
  onHistoryChangeRef.current = onHistoryChange;

  // fontSize SENGAJA jadi dependency — reconfigure lewat StateEffect.reconfigure di balik layar
  // react-codemirror tidak menghapus histori undo/redo maupun isi dokumen, jadi aman.
  const extensions = useMemo(
    () => [
      ...BASE_EXTENSIONS,
      EditorView.theme({ '&': { fontSize: `${fontSize}px` } }),
      EditorView.updateListener.of((update) => {
        if (!update.docChanged && update.transactions.length === 0) return;
        onHistoryChangeRef.current?.({
          canUndo: undoDepth(update.state) > 0,
          canRedo: redoDepth(update.state) > 0,
        });
      }),
    ],
    [fontSize],
  );

  useImperativeHandle(
    handleRef,
    () => ({
      undo: () => {
        const view = ref.current?.view;
        if (view) cmUndo(view);
      },
      redo: () => {
        const view = ref.current?.view;
        if (view) cmRedo(view);
      },
    }),
    [],
  );

  useEffect(() => {
    const view = ref.current?.view;
    if (!view) return;

    view.dispatch({ effects: setErrorLine.of(errorLine ?? null) });

    // Gulir ke baris bermasalah — percuma menyorot baris yang ada di luar layar.
    if (errorLine && errorLine >= 1 && errorLine <= view.state.doc.lines) {
      const pos = view.state.doc.line(errorLine).from;
      view.dispatch({ effects: EditorView.scrollIntoView(pos, { y: 'center' }) });
    }
  }, [errorLine]);

  return (
    <CodeMirror
      ref={ref}
      value={value}
      height="100%"
      className="code-editor"
      theme={theme}
      extensions={extensions}
      onChange={onChange}
      readOnly={readOnly}
      basicSetup={{ lineNumbers: true, foldGutter: true, closeBrackets: false }}
    />
  );
});
