/**
 * Execution engine: tree-walking interpreter asynchronous.
 * Port 1:1 dari `arduino_interpreter.dart` (lihat juga arduinoFloat.ts untuk
 * catatan penting soal representasi int vs float, yang tidak ada bedanya di JS).
 *
 * Alur kerja:
 *   1. Lexer  -> daftar token
 *   2. Parser -> AST (Program)
 *   3. Interpreter menjalankan AST:
 *      - deklarasi global & objek hardware
 *      - setup() dipanggil sekali
 *      - loop() dipanggil berulang sampai user menekan Stop
 *
 * Semua interaksi hardware dilempar ke HardwareInterface, sehingga interpreter
 * sepenuhnya terpisah dari UI/kanvas. delay() diimplementasikan dengan
 * setTimeout chunking sehingga UI TIDAK pernah freeze, dan Stop tetap
 * responsif bahkan di tengah delay panjang.
 */
import type { BoardId } from '../boardId';
import { type ArduinoNum, isFloatTyped, mkFloat, rawNum } from './arduinoFloat';
import { ArduinoParser } from './arduinoParser';
import type { Expr, Stmt } from './ast/astNode';
import {
  AssignExpr,
  BinaryExpr,
  CallExpr,
  GroupingExpr,
  IndexExpr,
  LiteralExpr,
  MemberExpr,
  MethodCallExpr,
  PostfixExpr,
  TernaryExpr,
  UnaryExpr,
  VariableExpr,
} from './ast/expressions';
import {
  BlockStmt,
  BreakStmt,
  ContinueStmt,
  DoWhileStmt,
  EnumDeclStmt,
  type EnumEntry,
  ExpressionStmt,
  ForStmt,
  FunctionDecl,
  IfStmt,
  ObjectDeclStmt,
  ReturnStmt,
  type StructField,
  StructDeclStmt,
  SwitchStmt,
  TypedefStmt,
  VarDeclStmt,
  WhileStmt,
} from './ast/statements';
import { BreakSignal, ContinueSignal, ReturnSignal, StopSignal } from './controlFlow';
import { Environment } from './environment';
import type { DigitalValue, HardwareInterface } from '../hal/hardwareInterface';
import {
  DhtInstance,
  EepromInstance,
  LcdInstance,
  RfidInstance,
  SerialInstance,
  ServoInstance,
  SpiInstance,
  StepperInstance,
  WireInstance,
} from './hardwareObjects';
import { Lexer } from './lexer';
import { collectDefines, expandMacros } from './preprocessor';
import { RuntimeError } from './runtimeError';
import { RuntimeStructField, StructInstance } from './structInstance';

/** Padanan ringan `Stopwatch` Dart, dipakai untuk millis()/micros(). */
class Clock {
  private startedAt = 0;
  private running = false;

  reset(): void {
    this.startedAt = nowMs();
    this.running = false;
  }

  start(): void {
    this.startedAt = nowMs();
    this.running = true;
  }

  stop(): void {
    this.running = false;
  }

  get elapsedMilliseconds(): number {
    return this.running ? Math.floor(nowMs() - this.startedAt) : 0;
  }

  get elapsedMicroseconds(): number {
    return this.running ? Math.floor((nowMs() - this.startedAt) * 1000) : 0;
  }
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/** PRNG seedable ringan (mulberry32) — padanan `math.Random([seed])` Dart. */
class SeededRandom {
  private state: number;
  constructor(seed?: number) {
    this.state = (seed ?? Date.now()) >>> 0;
  }
  nextInt(maxExclusive: number): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return Math.floor(r * maxExclusive);
  }
}

/** Elemen leaf/nested initializer array — sama seperti field `arrayInit` di parser. */
type InitElement = Expr | InitElement[];

interface InterruptEntry {
  isr: string;
  mode: number;
}

function clampInt(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}

/** Interpreter utama untuk sketch Arduino. */
export class ArduinoInterpreter {
  /** HAL tempat semua efek hardware dikirim (diimplementasikan wiringAwareController). */
  private readonly hardware: HardwareInterface;

  private globals = new Environment();
  private readonly functions = new Map<string, FunctionDecl>();
  private stopRequested = false;
  private readonly clock = new Clock();
  private opCounter = 0;
  private random = new SeededRandom();
  private readonly serial = new SerialInstance();
  private readonly structs = new Map<string, RuntimeStructField[]>();
  private readonly typeAliases = new Map<string, string>();
  private readonly interrupts = new Map<number, InterruptEntry>();
  private readonly lastInterruptPinValue = new Map<number, number>();
  private readonly pendingIsrs: string[] = [];
  private inIsr = false;
  private opsSinceRest = 0;
  private readonly boardId: BoardId;
  private static readonly INFINITE_LOOP_THRESHOLD = 10_000_000;

  constructor(hardware: HardwareInterface, boardId: BoardId = 'uno') {
    this.hardware = hardware;
    this.boardId = boardId;
  }

  /** Dipanggil simulator saat pin input digital berubah (mis. tombol ditekan) — memicu ISR yang cocok. */
  notifyDigitalChange(pin: number, value: number): void {
    const entry = this.interrupts.get(pin);
    if (!entry) return;
    const previous = this.lastInterruptPinValue.get(pin) ?? 0;
    this.lastInterruptPinValue.set(pin, value);
    if (previous === value) return;

    // Mode: 1 = CHANGE, 2 = FALLING, 3 = RISING (konvensi AVR).
    let shouldFire: boolean;
    switch (entry.mode) {
      case 1:
        shouldFire = true;
        break;
      case 2:
        shouldFire = previous === 1 && value === 0;
        break;
      case 3:
        shouldFire = previous === 0 && value === 1;
        break;
      default:
        shouldFire = value === 0; // LOW
    }
    if (shouldFire && this.pendingIsrs.length < 8) {
      this.pendingIsrs.push(entry.isr);
    }
  }

  /** Menjalankan semua ISR yang mengantri (di sela dua statement). */
  private async drainInterrupts(): Promise<void> {
    if (this.pendingIsrs.length === 0 || this.inIsr) return;
    while (this.pendingIsrs.length > 0) {
      const name = this.pendingIsrs.shift()!;
      const decl = this.functions.get(name);
      if (!decl) continue;
      this.inIsr = true;
      try {
        await this.callUserFunction(decl, [], decl.line);
      } finally {
        this.inIsr = false;
      }
    }
  }

  /** Meminta eksekusi berhenti (dipanggil tombol Stop). Efeknya terasa maksimal ~30ms kemudian. */
  stop(): void {
    this.stopRequested = true;
  }

  /**
   * Kompilasi + jalankan sketch dari awal sampai dihentikan.
   * Melempar Error (ArduinoSyntaxError/RuntimeError) jika kode salah.
   */
  async run(source: string): Promise<void> {
    this.stopRequested = false;
    this.opCounter = 0;
    this.opsSinceRest = 0;
    this.globals = new Environment();
    this.functions.clear();
    this.structs.clear();
    this.typeAliases.clear();
    this.interrupts.clear();
    this.lastInterruptPinValue.clear();
    this.pendingIsrs.length = 0;
    this.inIsr = false;
    this.random = new SeededRandom();
    this.installGlobalConstants();

    const defines = collectDefines(source);
    const tokens = expandMacros(new Lexer(source).tokenize(), defines);
    const program = new ArduinoParser(tokens).parseProgram();

    for (const decl of program.declarations) {
      if (decl instanceof FunctionDecl) {
        this.functions.set(decl.name, decl);
      } else {
        await this.execStmt(decl, this.globals);
      }
    }

    if (!this.functions.has('setup')) {
      throw new RuntimeError(1, "Function 'void setup()' not found");
    }
    if (!this.functions.has('loop')) {
      throw new RuntimeError(1, "Function 'void loop()' not found");
    }

    this.clock.reset();
    this.clock.start();

    try {
      await this.callUserFunction(this.functions.get('setup')!, [], 1);

      for (;;) {
        this.checkStop();
        await this.drainInterrupts();
        await this.callUserFunction(this.functions.get('loop')!, [], 1);
        this.opsSinceRest = 0;
        await yieldToEventLoop();
      }
    } catch (e) {
      if (!(e instanceof StopSignal)) throw e;
    } finally {
      this.clock.stop();
    }
  }

  /** Mendefinisikan konstanta bawaan Arduino di scope global — sebagian NILAINYA beda per
   * board asli (LED_BUILTIN, A0..A5), jadi tidak boleh di-hardcode satu skema Uno buat semua. */
  private installGlobalConstants(): void {
    this.globals.define('HIGH', 1);
    this.globals.define('LOW', 0);
    this.globals.define('INPUT', 0);
    this.globals.define('OUTPUT', 1);
    this.globals.define('INPUT_PULLUP', 2);
    this.installBoardSpecificConstants();
    this.globals.define('DEC', 10);
    this.globals.define('HEX', 16);
    this.globals.define('OCT', 8);
    this.globals.define('BIN', 2);
    this.globals.define('PI', mkFloat(Math.PI));
    this.globals.define('CHANGE', 1);
    this.globals.define('FALLING', 2);
    this.globals.define('RISING', 3);
    this.globals.define('LSBFIRST', 0);
    this.globals.define('MSBFIRST', 1);
    this.globals.define('DHT11', 11);
    this.globals.define('DHT21', 21);
    this.globals.define('DHT22', 22);
    this.globals.define('Serial', this.serial);
    this.globals.define('EEPROM', new EepromInstance());
    this.globals.define('Wire', new WireInstance());
    this.globals.define('SPI', new SpiInstance());
  }

  /**
   * LED_BUILTIN & A0..A5 — nomor pin literalnya BEDA per board asli (bukan detail
   * kosmetik), harus cocok dengan `boardPinLayout.ts` supaya kode yang nulis mis.
   * `digitalWrite(LED_BUILTIN, HIGH)` benar-benar menyalakan LED yang tersambung di
   * kanvas, bukan pin lain yang kebetulan sama nomornya di board berbeda.
   */
  private installBoardSpecificConstants(): void {
    switch (this.boardId) {
      case 'uno':
        this.globals.define('LED_BUILTIN', 13);
        // A0..A5 -> 14..19, konvensi resmi Arduino AVR (dipetakan berurutan setelah D13).
        this.globals.define('A0', 14);
        this.globals.define('A1', 15);
        this.globals.define('A2', 16);
        this.globals.define('A3', 17);
        this.globals.define('A4', 18);
        this.globals.define('A5', 19);
        break;
      case 'esp32':
        // GPIO2 -- konvensi de-facto tutorial ESP32 (banyak varian DevKit malah tidak
        // punya LED bawaan sama sekali, tapi ini yang paling umum diasumsikan contoh).
        this.globals.define('LED_BUILTIN', 2);
        // A0..A19 di core arduino-esp32 ASLI memetakan ke GPIO yang tidak berurutan &
        // beda per varian board -- sengaja TIDAK didefinisikan di sini daripada menebak
        // nilainya (salah tebak = salah nyala tanpa ketahuan). Sketch yang ditulis di
        // simulator ini pakai nomor GPIO langsung (mis. `analogRead(34)`), sama seperti
        // kebanyakan tutorial ESP32 di dunia nyata.
        break;
      case 'esp8266':
        // GPIO2 -- sama seperti ESP32, konvensi paling umum (NodeMCU D4). Catatan: di
        // board asli LED ini ACTIVE LOW (nyala saat LOW) -- polaritas terbalik ini
        // TIDAK disimulasikan (modul LED di kanvas menganggap semua LED active HIGH),
        // jadi arah nyala/mati LED_BUILTIN di simulator ini kebalikan dari board asli.
        this.globals.define('LED_BUILTIN', 2);
        // A0 = GPIO17 -- sesuai definisi resmi core esp8266 (satu-satunya pin analog).
        this.globals.define('A0', 17);
        break;
    }
  }

  private checkStop(): void {
    if (this.stopRequested) throw new StopSignal();
  }

  // ==========================================================
  // EKSEKUSI STATEMENT
  // ==========================================================

  private async execStmt(stmt: Stmt, env: Environment): Promise<void> {
    if (++this.opCounter >= 1500) {
      this.opCounter = 0;
      await yieldToEventLoop();
    }
    this.checkStop();

    if (++this.opsSinceRest > ArduinoInterpreter.INFINITE_LOOP_THRESHOLD) {
      throw new RuntimeError(stmt.line, 'Infinite loop detected — tambahkan delay() di dalam perulangan');
    }

    if (this.pendingIsrs.length > 0 && !this.inIsr) {
      await this.drainInterrupts();
    }

    if (stmt instanceof VarDeclStmt) {
      await this.execVarDecl(stmt, env);
    } else if (stmt instanceof ObjectDeclStmt) {
      await this.execObjectDecl(stmt, env);
    } else if (stmt instanceof ExpressionStmt) {
      await this.evalExpr(stmt.expression, env);
    } else if (stmt instanceof BlockStmt) {
      const blockEnv = new Environment(env);
      for (const s of stmt.statements) {
        await this.execStmt(s, blockEnv);
      }
    } else if (stmt instanceof IfStmt) {
      if (this.isTruthy(await this.evalExpr(stmt.condition, env))) {
        await this.execStmt(stmt.thenBranch, env);
      } else if (stmt.elseBranch) {
        await this.execStmt(stmt.elseBranch, env);
      }
    } else if (stmt instanceof SwitchStmt) {
      await this.execSwitch(stmt, env);
    } else if (stmt instanceof WhileStmt) {
      try {
        while (this.isTruthy(await this.evalExpr(stmt.condition, env))) {
          try {
            await this.execStmt(stmt.body, env);
          } catch (e) {
            if (!(e instanceof ContinueSignal)) throw e;
          }
        }
      } catch (e) {
        if (!(e instanceof BreakSignal)) throw e;
      }
    } else if (stmt instanceof DoWhileStmt) {
      try {
        do {
          try {
            await this.execStmt(stmt.body, env);
          } catch (e) {
            if (!(e instanceof ContinueSignal)) throw e;
          }
        } while (this.isTruthy(await this.evalExpr(stmt.condition, env)));
      } catch (e) {
        if (!(e instanceof BreakSignal)) throw e;
      }
    } else if (stmt instanceof ForStmt) {
      const forEnv = new Environment(env);
      if (stmt.initializer) {
        await this.execStmt(stmt.initializer, forEnv);
      }
      try {
        while (stmt.condition === undefined || this.isTruthy(await this.evalExpr(stmt.condition, forEnv))) {
          try {
            await this.execStmt(stmt.body, forEnv);
          } catch (e) {
            if (!(e instanceof ContinueSignal)) throw e;
          }
          if (stmt.update) {
            await this.evalExpr(stmt.update, forEnv);
          }
        }
      } catch (e) {
        if (!(e instanceof BreakSignal)) throw e;
      }
    } else if (stmt instanceof BreakStmt) {
      throw new BreakSignal();
    } else if (stmt instanceof ContinueStmt) {
      throw new ContinueSignal();
    } else if (stmt instanceof ReturnStmt) {
      const value = stmt.value === undefined ? undefined : await this.evalExpr(stmt.value, env);
      throw new ReturnSignal(value);
    } else if (stmt instanceof StructDeclStmt) {
      await this.execStructDecl(stmt, env);
    } else if (stmt instanceof EnumDeclStmt) {
      // Setiap entri enum menjadi konstanta int (auto-increment dari nilai eksplisit terakhir).
      let nextValue = 0;
      for (const entry of stmt.entries as EnumEntry[]) {
        if (entry.value !== undefined) {
          nextValue = this.asInt(await this.evalExpr(entry.value, env), stmt.line);
        }
        this.globals.define(entry.name, nextValue);
        nextValue++;
      }
    } else if (stmt instanceof TypedefStmt) {
      this.typeAliases.set(stmt.alias, stmt.baseType);
    } else if (stmt instanceof FunctionDecl) {
      this.functions.set(stmt.name, stmt);
    } else {
      throw new RuntimeError(stmt.line, 'Unsupported statement');
    }
  }

  /** Mendaftarkan struct: ukuran array field dievaluasi sekarang. */
  private async execStructDecl(stmt: StructDeclStmt, env: Environment): Promise<void> {
    const fields: RuntimeStructField[] = [];
    for (const f of stmt.fields as StructField[]) {
      let size: number | undefined;
      if (f.arraySize) {
        size = this.asInt(await this.evalExpr(f.arraySize, env), stmt.line);
      }
      fields.push(new RuntimeStructField(f.type, f.name, size));
    }
    this.structs.set(stmt.name, fields);
  }

  /** Menyelesaikan alias typedef ke tipe dasar (maks 8 tingkat). */
  private resolveType(type: string): string {
    let resolved = type;
    for (let i = 0; i < 8 && this.typeAliases.has(resolved); i++) {
      resolved = this.typeAliases.get(resolved)!;
    }
    return resolved;
  }

  /** Membuat instance struct baru dengan semua field bernilai default. */
  private instantiateStruct(name: string, line: number, depth = 0): StructInstance {
    if (depth > 16) {
      throw new RuntimeError(line, `Struct '${name}' is recursively nested`);
    }
    const fields = this.structs.get(name);
    if (!fields) {
      throw new RuntimeError(line, `Unknown struct '${name}'`);
    }
    const values = new Map<string, unknown>();
    for (const f of fields) {
      const resolvedFieldType = this.resolveType(f.type);
      const makeDefault = (): unknown =>
        this.structs.has(resolvedFieldType)
          ? this.instantiateStruct(resolvedFieldType, line, depth + 1)
          : this.defaultValue(resolvedFieldType);
      if (f.arraySize !== undefined) {
        values.set(
          f.name,
          Array.from({ length: f.arraySize }, () => makeDefault()),
        );
      } else {
        values.set(f.name, makeDefault());
      }
    }
    return new StructInstance(name, values);
  }

  /** Menjalankan deklarasi variabel: skalar, array 1D/2D/multi, struct, dan struct brace-init. */
  private async execVarDecl(stmt: VarDeclStmt, env: Environment): Promise<void> {
    const type = this.resolveType(stmt.type);
    for (const d of stmt.declarators) {
      let value: unknown;

      if (d.arraySizes.length > 0) {
        const dims: (number | undefined)[] = [];
        for (const sizeExpr of d.arraySizes) {
          dims.push(sizeExpr === undefined ? undefined : this.asInt(await this.evalExpr(sizeExpr, env), stmt.line));
        }
        value = await this.buildArrayValue(type, dims, 0, (d.arrayInit as InitElement[] | undefined) ?? undefined, env, stmt.line);
      } else if (d.arrayInit !== undefined) {
        if (this.structs.has(type)) {
          value = await this.structFromBraceInit(type, d.arrayInit as InitElement[], env, stmt.line);
        } else {
          throw new RuntimeError(stmt.line, 'Brace initializer needs an array or struct type');
        }
      } else if (d.initializer !== undefined) {
        value = this.coerce(type, await this.evalExpr(d.initializer, env), stmt.line);
      } else {
        value = this.structs.has(type) ? this.instantiateStruct(type, stmt.line) : this.defaultValue(type);
      }
      env.define(d.name, value);
    }
  }

  /** Membangun nilai array (rekursif per dimensi) dari dims dan initializer bersarang. */
  private async buildArrayValue(
    type: string,
    dims: (number | undefined)[],
    depth: number,
    init: InitElement | InitElement[] | undefined,
    env: Environment,
    line: number,
  ): Promise<unknown> {
    if (depth >= dims.length) {
      if (init === undefined) {
        return this.structs.has(type) ? this.instantiateStruct(type, line) : this.defaultValue(type);
      }
      if (!Array.isArray(init)) {
        // init adalah Expr (leaf tunggal).
        return this.coerce(type, await this.evalExpr(init, env), line);
      }
      // Leaf berupa brace: array of struct, mis. {{1,2},{3,4}}.
      if (this.structs.has(type)) {
        return this.structFromBraceInit(type, init, env, line);
      }
      throw new RuntimeError(line, 'Too many braces in array initializer');
    }

    const initList = Array.isArray(init) ? init : undefined;
    const declared = dims[depth];
    const length = declared ?? initList?.length ?? 0;
    if (length < 0) throw new RuntimeError(line, 'Invalid array size');

    const result: unknown[] = new Array(length).fill(undefined);
    for (let i = 0; i < length; i++) {
      const sub = initList && i < initList.length ? initList[i] : undefined;
      result[i] = await this.buildArrayValue(type, dims, depth + 1, sub, env, line);
    }
    return result;
  }

  /** Membuat struct dari brace-init berurutan: `Point p = {3, 4};` */
  private async structFromBraceInit(type: string, init: InitElement[], env: Environment, line: number): Promise<StructInstance> {
    const instance = this.instantiateStruct(type, line);
    const fields = this.structs.get(type)!;
    for (let i = 0; i < init.length && i < fields.length; i++) {
      const item = init[i];
      if (!Array.isArray(item)) {
        instance.fields.set(fields[i].name, this.coerce(this.resolveType(fields[i].type), await this.evalExpr(item, env), line));
      }
    }
    return instance;
  }

  /** Menjalankan deklarasi objek hardware (Servo, LiquidCrystal, DHT, Stepper, MFRC522). */
  private async execObjectDecl(stmt: ObjectDeclStmt, env: Environment): Promise<void> {
    const args: number[] = [];
    for (const e of stmt.args) {
      args.push(this.asInt(await this.evalExpr(e, env), stmt.line));
    }

    switch (stmt.className) {
      case 'Servo':
        env.define(stmt.name, new ServoInstance());
        break;
      case 'LiquidCrystal':
      case 'LiquidCrystal_I2C': // Alamat I2C diabaikan di simulator.
        env.define(stmt.name, new LcdInstance(args));
        break;
      case 'DHT':
        env.define(stmt.name, new DhtInstance(args.length > 0 ? args[0] : 2, args.length > 1 ? args[1] : 11));
        break;
      case 'Stepper':
        env.define(stmt.name, new StepperInstance(args.length > 0 ? args[0] : 200));
        break;
      case 'MFRC522':
        env.define(stmt.name, new RfidInstance());
        break;
      default:
        throw new RuntimeError(stmt.line, `Unknown class '${stmt.className}'`);
    }
  }

  /** Menjalankan switch-case dengan dukungan fall-through dan break. */
  private async execSwitch(stmt: SwitchStmt, env: Environment): Promise<void> {
    const value = await this.evalExpr(stmt.expression, env);

    let startIndex = -1;
    let defaultIndex = -1;
    for (let i = 0; i < stmt.cases.length; i++) {
      const c = stmt.cases[i];
      if (c.value === undefined) {
        defaultIndex = i;
        continue;
      }
      const caseValue = await this.evalExpr(c.value, env);
      if (this.looseEquals(value, caseValue)) {
        startIndex = i;
        break;
      }
    }
    if (startIndex === -1) startIndex = defaultIndex;
    if (startIndex === -1) return;

    const switchEnv = new Environment(env);
    try {
      for (let i = startIndex; i < stmt.cases.length; i++) {
        for (const s of stmt.cases[i].body) {
          await this.execStmt(s, switchEnv);
        }
      }
    } catch (e) {
      if (!(e instanceof BreakSignal)) throw e;
    }
  }

  // ==========================================================
  // EVALUASI EKSPRESI
  // ==========================================================

  private async evalExpr(expr: Expr, env: Environment): Promise<unknown> {
    if (expr instanceof LiteralExpr) return expr.value;

    if (expr instanceof VariableExpr) return env.get(expr.name, expr.line);

    if (expr instanceof GroupingExpr) return this.evalExpr(expr.expression, env);

    if (expr instanceof UnaryExpr) return this.evalUnary(expr, env);

    if (expr instanceof PostfixExpr) {
      const delta = expr.operator === '++' ? 1 : -1;
      return this.applyIncrement(expr.operand, delta, env, true);
    }

    if (expr instanceof BinaryExpr) return this.evalBinary(expr, env);

    if (expr instanceof TernaryExpr) {
      return this.isTruthy(await this.evalExpr(expr.condition, env))
        ? await this.evalExpr(expr.thenBranch, env)
        : await this.evalExpr(expr.elseBranch, env);
    }

    if (expr instanceof AssignExpr) return this.evalAssign(expr, env);

    if (expr instanceof IndexExpr) {
      const target = await this.evalExpr(expr.target, env);
      const index = this.asInt(await this.evalExpr(expr.index, env), expr.line);
      if (Array.isArray(target)) {
        if (index < 0 || index >= target.length) {
          throw new RuntimeError(expr.line, `Array index ${index} out of range (size ${target.length})`);
        }
        return target[index];
      }
      if (typeof target === 'string') {
        if (index < 0 || index >= target.length) {
          throw new RuntimeError(expr.line, `String index ${index} out of range`);
        }
        return target.charCodeAt(index);
      }
      throw new RuntimeError(expr.line, 'Value is not an array');
    }

    if (expr instanceof CallExpr) return this.evalCall(expr, env);

    if (expr instanceof MethodCallExpr) return this.evalMethodCall(expr, env);

    if (expr instanceof MemberExpr) {
      const target = await this.evalExpr(expr.target, env);
      if (target instanceof StructInstance) {
        if (!target.fields.has(expr.member)) {
          throw new RuntimeError(expr.line, `Struct '${target.typeName}' has no field '${expr.member}'`);
        }
        return target.fields.get(expr.member);
      }
      // RFID: rfid.uid -> struct dengan uidByte[] dan size, meniru struct Uid milik library MFRC522 asli.
      if (target instanceof RfidInstance && expr.member === 'uid') {
        const fields = new Map<string, unknown>();
        fields.set('uidByte', [...target.uid]);
        fields.set('size', target.uid.length);
        return new StructInstance('MFRC522_Uid', fields);
      }
      throw new RuntimeError(expr.line, `Cannot access member '${expr.member}' on this value`);
    }

    throw new RuntimeError(expr.line, 'Unsupported expression');
  }

  /** Evaluasi operator unary prefix. */
  private async evalUnary(expr: UnaryExpr, env: Environment): Promise<unknown> {
    if (expr.operator === '++' || expr.operator === '--') {
      const delta = expr.operator === '++' ? 1 : -1;
      return this.applyIncrement(expr.operand, delta, env, false);
    }

    const value = await this.evalExpr(expr.operand, env);
    switch (expr.operator) {
      case '-': {
        const n = this.asNum(value, expr.line);
        return isFloatTyped(n) ? mkFloat(-n.value) : -n;
      }
      case '+':
        return this.asNum(value, expr.line);
      case '!':
        return !this.isTruthy(value);
      case '~':
        return ~this.asInt(value, expr.line);
    }
    throw new RuntimeError(expr.line, `Unknown operator '${expr.operator}'`);
  }

  /** Menaikkan/menurunkan nilai variabel/elemen array/field struct sebesar delta. */
  private async applyIncrement(target: Expr, delta: number, env: Environment, returnOldValue: boolean): Promise<unknown> {
    const oldValue = await this.evalExpr(target, env);
    const oldNum = this.asNum(oldValue, target.line);
    const newValue: ArduinoNum = isFloatTyped(oldNum) ? mkFloat(oldNum.value + delta) : oldNum + delta;
    await this.assignToTarget(target, newValue, env);
    return returnOldValue ? oldValue : newValue;
  }

  /** Menulis value ke target lvalue: variabel, elemen array, atau field struct. */
  private async assignToTarget(target: Expr, value: unknown, env: Environment): Promise<void> {
    if (target instanceof VariableExpr) {
      env.assign(target.name, value, target.line);
      return;
    }
    if (target instanceof IndexExpr) {
      const listObj = await this.evalExpr(target.target, env);
      const index = this.asInt(await this.evalExpr(target.index, env), target.line);
      if (!Array.isArray(listObj)) {
        throw new RuntimeError(target.line, 'Value is not an array');
      }
      if (index < 0 || index >= listObj.length) {
        throw new RuntimeError(target.line, `Array index ${index} out of range`);
      }
      listObj[index] = value;
      return;
    }
    if (target instanceof MemberExpr) {
      const obj = await this.evalExpr(target.target, env);
      if (obj instanceof StructInstance) {
        if (!obj.fields.has(target.member)) {
          throw new RuntimeError(target.line, `Struct '${obj.typeName}' has no field '${target.member}'`);
        }
        obj.fields.set(target.member, value);
        return;
      }
      throw new RuntimeError(target.line, 'Cannot assign to this member');
    }
    throw new RuntimeError(target.line, 'Invalid assignment target');
  }

  /** Evaluasi operator biner (dengan short-circuit untuk && dan ||). */
  private async evalBinary(expr: BinaryExpr, env: Environment): Promise<unknown> {
    if (expr.operator === '&&') {
      if (!this.isTruthy(await this.evalExpr(expr.left, env))) return false;
      return this.isTruthy(await this.evalExpr(expr.right, env));
    }
    if (expr.operator === '||') {
      if (this.isTruthy(await this.evalExpr(expr.left, env))) return true;
      return this.isTruthy(await this.evalExpr(expr.right, env));
    }

    const left = await this.evalExpr(expr.left, env);
    const right = await this.evalExpr(expr.right, env);
    return this.applyBinary(expr.operator, left, right, expr.line);
  }

  /** Menerapkan operator biner pada dua nilai yang sudah dievaluasi. */
  private applyBinary(op: string, left: unknown, right: unknown, line: number): unknown {
    switch (op) {
      case '+':
        if (typeof left === 'string' || typeof right === 'string') {
          return this.stringify(left) + this.stringify(right);
        }
        return this.numOp(left, right, line, (a, b) => a + b);
      case '-':
        return this.numOp(left, right, line, (a, b) => a - b);
      case '*':
        return this.numOp(left, right, line, (a, b) => a * b);
      case '/': {
        const a = this.asNum(left, line);
        const b = this.asNum(right, line);
        if (!isFloatTyped(a) && !isFloatTyped(b)) {
          // Pembagian int meniru C++: hasil dipotong (5/2 = 2).
          if (rawNum(b) === 0) throw new RuntimeError(line, 'Division by zero');
          return Math.trunc(rawNum(a) / rawNum(b));
        }
        if (rawNum(b) === 0) throw new RuntimeError(line, 'Division by zero');
        return mkFloat(rawNum(a) / rawNum(b));
      }
      case '%': {
        // remainder() meniru perilaku % C++ (JS % juga truncating toward zero, sama seperti Dart num.remainder()).
        const a = this.asNum(left, line);
        const b = this.asNum(right, line);
        if (rawNum(b) === 0) throw new RuntimeError(line, 'Modulo by zero');
        return this.combinePreservingType(a, b, (x, y) => x % y);
      }
      case '==':
        return this.looseEquals(left, right);
      case '!=':
        return !this.looseEquals(left, right);
      case '>':
        return this.compare(left, right, line) > 0;
      case '<':
        return this.compare(left, right, line) < 0;
      case '>=':
        return this.compare(left, right, line) >= 0;
      case '<=':
        return this.compare(left, right, line) <= 0;
      case '&':
        return this.asInt(left, line) & this.asInt(right, line);
      case '|':
        return this.asInt(left, line) | this.asInt(right, line);
      case '^':
        return this.asInt(left, line) ^ this.asInt(right, line);
      case '<<':
        return this.asInt(left, line) << this.asInt(right, line);
      case '>>':
        return this.asInt(left, line) >> this.asInt(right, line);
    }
    throw new RuntimeError(line, `Unknown operator '${op}'`);
  }

  /** Operasi numerik yang mempertahankan int bila kedua operan int, float jika salah satunya float. */
  private numOp(left: unknown, right: unknown, line: number, f: (a: number, b: number) => number): ArduinoNum {
    const a = this.asNum(left, line);
    const b = this.asNum(right, line);
    return this.combinePreservingType(a, b, f);
  }

  private combinePreservingType(a: ArduinoNum, b: ArduinoNum, f: (x: number, y: number) => number): ArduinoNum {
    const result = f(rawNum(a), rawNum(b));
    if (!isFloatTyped(a) && !isFloatTyped(b)) return Math.trunc(result);
    return mkFloat(result);
  }

  /** Evaluasi penugasan (=, +=, -=, *=, /=, %=). */
  private async evalAssign(expr: AssignExpr, env: Environment): Promise<unknown> {
    let value = await this.evalExpr(expr.value, env);

    if (expr.operator !== '=') {
      const op = expr.operator[0]; // '+=' -> '+'
      const oldValue = await this.evalExpr(expr.target, env);
      value = this.applyBinary(op, oldValue, value, expr.line);
    }

    await this.assignToTarget(expr.target, value, env);
    return value;
  }

  // ==========================================================
  // PEMANGGILAN FUNGSI (builtin Arduino + fungsi user)
  // ==========================================================

  private async evalCall(expr: CallExpr, env: Environment): Promise<unknown> {
    const line = expr.line;

    // ---- Special form: butuh AST argumen (bukan nilai) ----
    switch (expr.name) {
      case 'attachInterrupt': {
        if (expr.args.length !== 3) {
          throw new RuntimeError(line, 'attachInterrupt() expects 3 arguments');
        }
        const isrExpr = expr.args[1];
        if (!(isrExpr instanceof VariableExpr)) {
          throw new RuntimeError(line, 'ISR must be a function name');
        }
        if (!this.functions.has(isrExpr.name)) {
          throw new RuntimeError(line, `Unknown function '${isrExpr.name}'`);
        }
        const pin = this.asInt(await this.evalExpr(expr.args[0], env), line);
        const mode = this.asInt(await this.evalExpr(expr.args[2], env), line);
        this.interrupts.set(pin, { isr: isrExpr.name, mode });
        this.lastInterruptPinValue.set(pin, this.hardware.digitalRead(pin));
        return undefined;
      }

      case 'detachInterrupt': {
        if (expr.args.length > 0) {
          const pin = this.asInt(await this.evalExpr(expr.args[0], env), line);
          this.interrupts.delete(pin);
        }
        return undefined;
      }

      case 'bitWrite':
      case 'bitSet':
      case 'bitClear':
      case 'bitToggle': {
        if (expr.args.length < 2) {
          throw new RuntimeError(line, `${expr.name}() expects at least 2 arguments`);
        }
        const target = expr.args[0];
        const oldBits = this.asInt(await this.evalExpr(target, env), line);
        const bit = this.asInt(await this.evalExpr(expr.args[1], env), line);
        let newBits: number;
        switch (expr.name) {
          case 'bitWrite': {
            if (expr.args.length !== 3) {
              throw new RuntimeError(line, 'bitWrite() expects 3 arguments');
            }
            const on = this.isTruthy(await this.evalExpr(expr.args[2], env));
            newBits = on ? oldBits | (1 << bit) : oldBits & ~(1 << bit);
            break;
          }
          case 'bitSet':
            newBits = oldBits | (1 << bit);
            break;
          case 'bitClear':
            newBits = oldBits & ~(1 << bit);
            break;
          default: // bitToggle
            newBits = oldBits ^ (1 << bit);
        }
        if (target instanceof VariableExpr || target instanceof IndexExpr || target instanceof MemberExpr) {
          await this.assignToTarget(target, newBits, env);
        }
        return newBits;
      }
    }

    // Evaluasi semua argumen terlebih dahulu.
    const args: unknown[] = [];
    for (const a of expr.args) {
      args.push(await this.evalExpr(a, env));
    }

    switch (expr.name) {
      // ----- Pin I/O -----
      case 'pinMode':
        this.requireArgs(args, 2, 'pinMode', line);
        this.hardware.pinMode(this.asInt(args[0], line), this.asInt(args[1], line) as 0 | 1 | 2);
        return undefined;
      case 'digitalWrite':
        this.requireArgs(args, 2, 'digitalWrite', line);
        this.hardware.digitalWrite(this.asInt(args[0], line), (this.isTruthy(args[1]) ? 1 : 0) as DigitalValue);
        return undefined;
      case 'digitalRead':
        this.requireArgs(args, 1, 'digitalRead', line);
        return this.hardware.digitalRead(this.asInt(args[0], line));
      case 'analogRead':
        this.requireArgs(args, 1, 'analogRead', line);
        return this.hardware.analogRead(this.asInt(args[0], line));
      case 'analogWrite':
        this.requireArgs(args, 2, 'analogWrite', line);
        this.hardware.analogWrite(this.asInt(args[0], line), clampInt(this.asInt(args[1], line), 0, 255));
        return undefined;

      // ----- Waktu -----
      case 'delay':
        this.requireArgs(args, 1, 'delay', line);
        await this.asyncDelay(this.asInt(args[0], line));
        return undefined;
      case 'delayMicroseconds':
        this.requireArgs(args, 1, 'delayMicroseconds', line);
        await this.asyncDelay(Math.ceil(this.asInt(args[0], line) / 1000));
        return undefined;
      case 'millis':
        return this.clock.elapsedMilliseconds;
      case 'micros':
        return this.clock.elapsedMicroseconds;

      // ----- Buzzer -----
      case 'tone':
        if (args.length < 2 || args.length > 3) {
          throw new RuntimeError(line, 'tone() expects 2 or 3 arguments');
        }
        this.hardware.tone(this.asInt(args[0], line), this.asInt(args[1], line), args.length === 3 ? this.asInt(args[2], line) : undefined);
        return undefined;
      case 'noTone':
        this.requireArgs(args, 1, 'noTone', line);
        this.hardware.noTone(this.asInt(args[0], line));
        return undefined;

      // ----- Matematika Arduino -----
      case 'map': {
        this.requireArgs(args, 5, 'map', line);
        const x = this.asInt(args[0], line);
        const inMin = this.asInt(args[1], line);
        const inMax = this.asInt(args[2], line);
        const outMin = this.asInt(args[3], line);
        const outMax = this.asInt(args[4], line);
        if (inMax === inMin) {
          throw new RuntimeError(line, 'map() input range is zero');
        }
        return Math.trunc(((x - inMin) * (outMax - outMin)) / (inMax - inMin)) + outMin;
      }
      case 'constrain': {
        this.requireArgs(args, 3, 'constrain', line);
        const v = this.asNum(args[0], line);
        const lo = this.asNum(args[1], line);
        const hi = this.asNum(args[2], line);
        if (rawNum(v) < rawNum(lo)) return lo;
        if (rawNum(v) > rawNum(hi)) return hi;
        return v;
      }
      case 'min': {
        this.requireArgs(args, 2, 'min', line);
        const a = this.asNum(args[0], line);
        const b = this.asNum(args[1], line);
        return rawNum(a) <= rawNum(b) ? a : b;
      }
      case 'max': {
        this.requireArgs(args, 2, 'max', line);
        const a = this.asNum(args[0], line);
        const b = this.asNum(args[1], line);
        return rawNum(a) >= rawNum(b) ? a : b;
      }
      case 'abs': {
        this.requireArgs(args, 1, 'abs', line);
        const v = this.asNum(args[0], line);
        return isFloatTyped(v) ? mkFloat(Math.abs(v.value)) : Math.abs(v);
      }
      case 'pow':
        this.requireArgs(args, 2, 'pow', line);
        return mkFloat(Math.pow(rawNum(this.asNum(args[0], line)), rawNum(this.asNum(args[1], line))));
      case 'sqrt':
        this.requireArgs(args, 1, 'sqrt', line);
        return mkFloat(Math.sqrt(rawNum(this.asNum(args[0], line))));
      case 'sq': {
        this.requireArgs(args, 1, 'sq', line);
        const n = this.asNum(args[0], line);
        return isFloatTyped(n) ? mkFloat(n.value * n.value) : n * n;
      }
      case 'random':
        if (args.length === 1) {
          const maxV = this.asInt(args[0], line);
          if (maxV <= 0) return 0;
          return this.random.nextInt(maxV);
        }
        if (args.length === 2) {
          const minV = this.asInt(args[0], line);
          const maxV = this.asInt(args[1], line);
          if (maxV <= minV) return minV;
          return minV + this.random.nextInt(maxV - minV);
        }
        throw new RuntimeError(line, 'random() expects 1 or 2 arguments');
      case 'randomSeed':
        this.requireArgs(args, 1, 'randomSeed', line);
        this.random = new SeededRandom(this.asInt(args[0], line));
        return undefined;
      case 'sin':
        this.requireArgs(args, 1, 'sin', line);
        return mkFloat(Math.sin(rawNum(this.asNum(args[0], line))));
      case 'cos':
        this.requireArgs(args, 1, 'cos', line);
        return mkFloat(Math.cos(rawNum(this.asNum(args[0], line))));
      case 'tan':
        this.requireArgs(args, 1, 'tan', line);
        return mkFloat(Math.tan(rawNum(this.asNum(args[0], line))));
      case 'radians':
        this.requireArgs(args, 1, 'radians', line);
        return mkFloat((rawNum(this.asNum(args[0], line)) * Math.PI) / 180.0);
      case 'degrees':
        this.requireArgs(args, 1, 'degrees', line);
        return mkFloat((rawNum(this.asNum(args[0], line)) * 180.0) / Math.PI);

      // ----- Manipulasi bit (baca saja; tulis ada di special form) -----
      case 'bitRead':
        this.requireArgs(args, 2, 'bitRead', line);
        return (this.asInt(args[0], line) >> this.asInt(args[1], line)) & 1;
      case 'bit':
        this.requireArgs(args, 1, 'bit', line);
        return 1 << this.asInt(args[0], line);
      case 'lowByte':
        this.requireArgs(args, 1, 'lowByte', line);
        return this.asInt(args[0], line) & 0xff;
      case 'highByte':
        this.requireArgs(args, 1, 'highByte', line);
        return (this.asInt(args[0], line) >> 8) & 0xff;

      // ----- Shift register & pulsa -----
      case 'shiftOut':
        this.requireArgs(args, 4, 'shiftOut', line);
        this.hardware.shiftOut(this.asInt(args[0], line), this.asInt(args[1], line), this.asInt(args[2], line), this.asInt(args[3], line) & 0xff);
        return undefined;
      case 'shiftIn':
        // Tidak ada sumber data serial-in di simulator -> 0.
        return 0;
      case 'pulseIn':
        if (args.length < 2 || args.length > 3) {
          throw new RuntimeError(line, 'pulseIn() expects 2 or 3 arguments');
        }
        return this.hardware.pulseIn(this.asInt(args[0], line), this.asInt(args[1], line) as DigitalValue);

      // ----- Interrupt helper -----
      case 'digitalPinToInterrupt':
        this.requireArgs(args, 1, 'digitalPinToInterrupt', line);
        return this.asInt(args[0], line); // Identitas pada simulator.
      case 'interrupts':
      case 'noInterrupts':
        return undefined;

      // ----- Konversi tipe gaya C++: int(x), float(x), dst -----
      case 'int':
      case 'long':
      case 'short':
      case 'byte':
      case 'char':
      case 'word':
        return this.asInt(args.length > 0 ? args[0] : 0, line);
      case 'float':
      case 'double':
        return mkFloat(rawNum(this.asNum(args.length > 0 ? args[0] : 0, line)));
      case 'bool':
      case 'boolean':
        return this.isTruthy(args.length > 0 ? args[0] : false);
      case 'String':
        if (args.length === 2 && typeof args[0] === 'number') {
          return (args[0] as number).toString(this.asInt(args[1], line)).toUpperCase();
        }
        return this.stringify(args.length > 0 ? args[0] : '');
    }

    // ----- Fungsi buatan user -----
    const decl = this.functions.get(expr.name);
    if (decl) {
      return this.callUserFunction(decl, args, line);
    }

    throw new RuntimeError(line, `Unknown function '${expr.name}'`);
  }

  /** Memanggil fungsi buatan user dengan scope baru di atas global. */
  private async callUserFunction(decl: FunctionDecl, args: unknown[], callLine: number): Promise<unknown> {
    if (args.length !== decl.params.length) {
      throw new RuntimeError(callLine, `'${decl.name}' expects ${decl.params.length} argument(s), got ${args.length}`);
    }
    const fnEnv = new Environment(this.globals);
    for (let i = 0; i < decl.params.length; i++) {
      fnEnv.define(decl.params[i].name, this.coerce(decl.params[i].type, args[i], callLine));
    }
    try {
      for (const s of decl.body.statements) {
        await this.execStmt(s, fnEnv);
      }
    } catch (e) {
      if (e instanceof ReturnSignal) {
        if (decl.returnType === 'void') return undefined;
        return this.coerce(decl.returnType, e.value, callLine);
      }
      throw e;
    }
    return undefined; // Fungsi selesai tanpa return eksplisit.
  }

  // ==========================================================
  // PEMANGGILAN METHOD OBJEK (Serial, Servo, LCD, String)
  // ==========================================================

  private async evalMethodCall(expr: MethodCallExpr, env: Environment): Promise<unknown> {
    const target = await this.evalExpr(expr.target, env);
    const args: unknown[] = [];
    for (const a of expr.args) {
      args.push(await this.evalExpr(a, env));
    }
    const line = expr.line;
    const m = expr.method;

    // ----- Serial -----
    if (target instanceof SerialInstance) {
      switch (m) {
        case 'begin':
          target.baudRate = args.length > 0 ? this.asInt(args[0], line) : 9600;
          this.hardware.serialBegin(target.baudRate);
          return undefined;
        case 'print':
          this.hardware.serialPrint(this.formatSerial(args, line));
          return undefined;
        case 'println':
          this.hardware.serialPrintln(args.length === 0 ? '' : this.formatSerial(args, line));
          return undefined;
        case 'available':
          return this.hardware.serialAvailable();
        case 'read':
          return this.hardware.serialRead();
        case 'peek':
          return this.hardware.serialPeek();
        case 'parseInt':
          return this.serialParseNumber(false);
        case 'parseFloat':
          return this.serialParseNumber(true);
        case 'readString': {
          let s = '';
          while (this.hardware.serialAvailable() > 0) {
            s += String.fromCharCode(this.hardware.serialRead());
          }
          return s;
        }
        case 'readStringUntil': {
          this.requireArgs(args, 1, 'readStringUntil', line);
          const terminator = this.asInt(args[0], line);
          let s = '';
          while (this.hardware.serialAvailable() > 0) {
            const c = this.hardware.serialRead();
            if (c === terminator) break;
            s += String.fromCharCode(c);
          }
          return s;
        }
        case 'setTimeout':
        case 'end':
        case 'flush':
          return undefined;
      }
      throw new RuntimeError(line, `Unknown Serial method '${m}'`);
    }

    // ----- EEPROM virtual (1024 byte, bertahan antar Run) -----
    if (target instanceof EepromInstance) {
      switch (m) {
        case 'read': {
          this.requireArgs(args, 1, 'EEPROM.read', line);
          const addr = this.asInt(args[0], line);
          if (addr < 0 || addr >= EepromInstance.size) return 0;
          return EepromInstance.bytes[addr];
        }
        case 'write':
        case 'update': {
          this.requireArgs(args, 2, `EEPROM.${m}`, line);
          const addr = this.asInt(args[0], line);
          if (addr >= 0 && addr < EepromInstance.size) {
            EepromInstance.bytes[addr] = this.asInt(args[1], line) & 0xff;
          }
          return undefined;
        }
        case 'put':
          this.requireArgs(args, 2, 'EEPROM.put', line);
          EepromInstance.objects.set(this.asInt(args[0], line), args[1]);
          return args[1];
        case 'get': {
          if (expr.args.length !== 2) {
            throw new RuntimeError(line, 'EEPROM.get() expects 2 arguments');
          }
          const addr = this.asInt(args[0], line);
          const stored = EepromInstance.objects.get(addr) ?? 0;
          const ref = expr.args[1];
          if (ref instanceof VariableExpr || ref instanceof IndexExpr || ref instanceof MemberExpr) {
            await this.assignToTarget(ref, stored, env);
          }
          return stored;
        }
        case 'length':
          return EepromInstance.size;
      }
      throw new RuntimeError(line, `Unknown EEPROM method '${m}'`);
    }

    // ----- Wire (I2C virtual — no-op agar sketch tetap jalan) -----
    if (target instanceof WireInstance) {
      switch (m) {
        case 'begin':
        case 'beginTransmission':
        case 'setClock':
        case 'end':
          return undefined;
        case 'endTransmission':
          return 0;
        case 'write':
          return 1;
        case 'read':
        case 'requestFrom':
        case 'available':
          return 0;
      }
      throw new RuntimeError(line, `Unknown Wire method '${m}'`);
    }

    // ----- SPI (virtual — transfer selalu 0) -----
    if (target instanceof SpiInstance) {
      switch (m) {
        case 'begin':
        case 'end':
        case 'beginTransaction':
        case 'endTransaction':
        case 'setBitOrder':
        case 'setDataMode':
        case 'setClockDivider':
          return undefined;
        case 'transfer':
        case 'transfer16':
          return 0;
      }
      throw new RuntimeError(line, `Unknown SPI method '${m}'`);
    }

    // ----- DHT11/DHT22 (suhu & kelembapan dari slider) -----
    if (target instanceof DhtInstance) {
      switch (m) {
        case 'begin':
          return undefined;
        case 'readTemperature':
          return mkFloat(this.hardware.readTemperature());
        case 'readHumidity':
          return mkFloat(this.hardware.readHumidity());
      }
      throw new RuntimeError(line, `Unknown DHT method '${m}'`);
    }

    // ----- RFID RC522 virtual -----
    if (target instanceof RfidInstance) {
      switch (m) {
        case 'PCD_Init':
        case 'PCD_StopCrypto1':
        case 'PICC_HaltA':
          return undefined;
        case 'PICC_IsNewCardPresent':
          return this.hardware.rfidNewCardPresent();
        case 'PICC_ReadCardSerial': {
          const uid = this.hardware.rfidUid();
          if (uid.length === 0) return false;
          target.uid = [...uid];
          return true;
        }
        case 'getUidString':
          return target.uidString;
      }
      throw new RuntimeError(line, `Unknown MFRC522 method '${m}'`);
    }

    // ----- Stepper motor virtual -----
    if (target instanceof StepperInstance) {
      switch (m) {
        case 'setSpeed':
          this.requireArgs(args, 1, 'setSpeed', line);
          target.rpm = this.asInt(args[0], line);
          return undefined;
        case 'step': {
          this.requireArgs(args, 1, 'step', line);
          const steps = this.asInt(args[0], line);
          this.hardware.stepperStep(steps, target.stepsPerRevolution);
          // Meniru sifat blocking Stepper.step() sesuai RPM (dibatasi 2 detik).
          if (target.rpm > 0 && steps !== 0) {
            const ms = clampInt(Math.trunc((Math.abs(steps) * 60000) / (target.rpm * target.stepsPerRevolution)), 0, 2000);
            await this.asyncDelay(ms);
          }
          return undefined;
        }
      }
      throw new RuntimeError(line, `Unknown Stepper method '${m}'`);
    }

    // ----- Servo -----
    if (target instanceof ServoInstance) {
      switch (m) {
        case 'attach':
          this.requireArgs(args, 1, 'attach', line);
          target.pin = this.asInt(args[0], line);
          this.hardware.servoWrite(target.pin, target.angle);
          return undefined;
        case 'write':
          this.requireArgs(args, 1, 'write', line);
          if (target.pin === undefined) {
            throw new RuntimeError(line, 'Servo is not attached to any pin');
          }
          target.angle = clampInt(this.asInt(args[0], line), 0, 180);
          this.hardware.servoWrite(target.pin, target.angle);
          return undefined;
        case 'read':
          return target.angle;
        case 'attached':
          return target.pin !== undefined;
        case 'detach':
          if (target.pin !== undefined) this.hardware.servoDetach(target.pin);
          target.pin = undefined;
          return undefined;
      }
      throw new RuntimeError(line, `Unknown Servo method '${m}'`);
    }

    // ----- LCD 16x2 -----
    if (target instanceof LcdInstance) {
      switch (m) {
        case 'begin':
          this.hardware.lcdBegin(args.length > 0 ? this.asInt(args[0], line) : 16, args.length > 1 ? this.asInt(args[1], line) : 2);
          return undefined;
        case 'print':
          this.hardware.lcdPrint(this.formatSerial(args, line));
          return undefined;
        case 'clear':
          this.hardware.lcdClear();
          return undefined;
        case 'setCursor':
          this.requireArgs(args, 2, 'setCursor', line);
          this.hardware.lcdSetCursor(this.asInt(args[0], line), this.asInt(args[1], line));
          return undefined;
        case 'home':
          this.hardware.lcdSetCursor(0, 0);
          return undefined;
        case 'init': // LiquidCrystal_I2C: lcd.init() = begin 16x2.
          this.hardware.lcdBegin(16, 2);
          return undefined;
        case 'backlight':
        case 'noBacklight':
        case 'noDisplay':
        case 'display':
        case 'cursor':
        case 'noCursor':
        case 'blink':
        case 'noBlink':
          return undefined;
      }
      throw new RuntimeError(line, `Unknown LCD method '${m}'`);
    }

    // ----- Method String Arduino -----
    if (typeof target === 'string') {
      switch (m) {
        case 'length':
          return target.length;
        case 'charAt': {
          this.requireArgs(args, 1, 'charAt', line);
          const i = this.asInt(args[0], line);
          if (i < 0 || i >= target.length) return 0;
          return target.charCodeAt(i);
        }
        case 'substring':
          if (args.length === 1) {
            return target.substring(this.asInt(args[0], line));
          }
          this.requireArgs(args, 2, 'substring', line);
          return target.substring(this.asInt(args[0], line), this.asInt(args[1], line));
        case 'indexOf':
          this.requireArgs(args, 1, 'indexOf', line);
          return target.indexOf(this.stringify(args[0]));
        case 'toUpperCase':
          return target.toUpperCase();
        case 'toLowerCase':
          return target.toLowerCase();
        case 'toInt': {
          const parsed = parseInt(target.trim(), 10);
          return Number.isNaN(parsed) ? 0 : parsed;
        }
        case 'toFloat': {
          const parsed = parseFloat(target.trim());
          return mkFloat(Number.isNaN(parsed) ? 0.0 : parsed);
        }
        case 'trim':
          return target.trim();
        case 'equals':
          this.requireArgs(args, 1, 'equals', line);
          return target === this.stringify(args[0]);
        case 'startsWith':
          this.requireArgs(args, 1, 'startsWith', line);
          return target.startsWith(this.stringify(args[0]));
        case 'endsWith':
          this.requireArgs(args, 1, 'endsWith', line);
          return target.endsWith(this.stringify(args[0]));
        case 'concat':
          this.requireArgs(args, 1, 'concat', line);
          return target + this.stringify(args[0]);
        case 'replace':
          this.requireArgs(args, 2, 'replace', line);
          return target.split(this.stringify(args[0])).join(this.stringify(args[1]));
        case 'remove': {
          if (args.length === 0 || args.length > 2) {
            throw new RuntimeError(line, 'remove() expects 1 or 2 arguments');
          }
          const start = clampInt(this.asInt(args[0], line), 0, target.length);
          const end = args.length === 2 ? clampInt(start + this.asInt(args[1], line), start, target.length) : target.length;
          return target.substring(0, start) + target.substring(end);
        }
        case 'equalsIgnoreCase':
          this.requireArgs(args, 1, 'equalsIgnoreCase', line);
          return target.toLowerCase() === this.stringify(args[0]).toLowerCase();
        case 'isEmpty':
          return target.length === 0;
      }
      throw new RuntimeError(line, `Unknown String method '${m}'`);
    }

    throw new RuntimeError(line, `Cannot call method '${m}' on this value`);
  }

  // ==========================================================
  // DELAY ASYNCHRONOUS
  // ==========================================================

  /** Serial.parseInt() / parseFloat(): lewati karakter non-angka, lalu baca angka berikutnya. */
  private serialParseNumber(asFloat: boolean): ArduinoNum {
    for (;;) {
      const c = this.hardware.serialPeek();
      if (c === -1) return asFloat ? mkFloat(0) : 0;
      const isDigit = c >= 48 && c <= 57;
      if (isDigit || c === 45 /* '-' */) break;
      this.hardware.serialRead();
    }
    let s = '';
    let seenDot = false;
    for (;;) {
      const c = this.hardware.serialPeek();
      if (c === -1) break;
      const isDigit = c >= 48 && c <= 57;
      const isMinus = c === 45 && s.length === 0;
      const isDot = c === 46 && asFloat && !seenDot;
      if (!isDigit && !isMinus && !isDot) break;
      if (isDot) seenDot = true;
      s += String.fromCharCode(this.hardware.serialRead());
    }
    if (asFloat) {
      const parsed = parseFloat(s);
      return mkFloat(Number.isNaN(parsed) ? 0 : parsed);
    }
    const parsed = parseInt(s, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  /** delay() versi asynchronous: menunggu dalam potongan kecil (maks 30ms) sambil mengecek Stop. */
  private async asyncDelay(ms: number): Promise<void> {
    this.opsSinceRest = 0; // delay() dihitung sebagai "istirahat" oleh detektor infinite loop.
    if (ms <= 0) {
      await yieldToEventLoop();
      return;
    }
    const deadline = this.clock.elapsedMilliseconds + ms;
    while (this.clock.elapsedMilliseconds < deadline) {
      this.checkStop();
      const remaining = deadline - this.clock.elapsedMilliseconds;
      await sleep(Math.min(30, remaining));
    }
    this.checkStop();
  }

  // ==========================================================
  // KONVERSI & UTILITAS NILAI
  // ==========================================================

  private requireArgs(args: unknown[], count: number, name: string, line: number): void {
    if (args.length !== count) {
      throw new RuntimeError(line, `${name}() expects ${count} argument(s), got ${args.length}`);
    }
  }

  /** Konversi nilai ke tipe deklarasi (meniru cast implisit C++). */
  private coerce(type: string, value: unknown, line: number): unknown {
    const resolved = this.resolveType(type);
    if (this.structs.has(resolved)) return value; // Struct: referensi instance apa adanya.
    switch (resolved) {
      case 'int':
      case 'long':
      case 'short':
      case 'byte':
      case 'char':
      case 'word':
        return this.asInt(value, line);
      case 'float':
      case 'double':
        return mkFloat(rawNum(this.asNum(value, line)));
      case 'bool':
      case 'boolean':
        return this.isTruthy(value);
      case 'String':
        return this.stringify(value);
      case 'void':
        return value;
      case 'Servo':
        return value instanceof ServoInstance ? value : new ServoInstance();
      default:
        return value;
    }
  }

  /** Nilai default tiap tipe saat variabel dideklarasi tanpa nilai. */
  private defaultValue(type: string): unknown {
    switch (type) {
      case 'float':
      case 'double':
        return mkFloat(0);
      case 'bool':
      case 'boolean':
        return false;
      case 'String':
        return '';
      case 'Servo':
        return new ServoInstance();
      default:
        return 0; // int, long, byte, char, ...
    }
  }

  /** Aturan "truthy" meniru C++: angka != 0, bool apa adanya. */
  private isTruthy(value: unknown): boolean {
    if (value === undefined || value === null) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (isFloatTyped(value)) return value.value !== 0;
    if (typeof value === 'string') return value.length > 0;
    return true;
  }

  /** Konversi ke ArduinoNum (int atau float); error runtime jika bukan angka. */
  private asNum(value: unknown, line: number): ArduinoNum {
    if (typeof value === 'number') return value;
    if (isFloatTyped(value)) return value;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (/^-?\d+$/.test(trimmed)) return parseInt(trimmed, 10);
      const parsed = parseFloat(trimmed);
      if (!Number.isNaN(parsed)) return mkFloat(parsed);
    }
    throw new RuntimeError(line, 'Expected a number');
  }

  /** Konversi ke int (double dipotong seperti cast C++). */
  private asInt(value: unknown, line: number): number {
    return Math.trunc(rawNum(this.asNum(value, line)));
  }

  /** Kesetaraan longgar: 1 == 1.0 dianggap sama, seperti C++. */
  private looseEquals(a: unknown, b: unknown): boolean {
    const aIsNum = typeof a === 'number' || isFloatTyped(a);
    const bIsNum = typeof b === 'number' || isFloatTyped(b);
    if (aIsNum && bIsNum) return rawNum(a as ArduinoNum) === rawNum(b as ArduinoNum);
    if (typeof a === 'boolean' || typeof b === 'boolean') {
      return this.isTruthy(a) === this.isTruthy(b);
    }
    return a === b;
  }

  /** Perbandingan urutan untuk < > <= >=. */
  private compare(a: unknown, b: unknown, line: number): number {
    const aIsNum = typeof a === 'number' || isFloatTyped(a);
    const bIsNum = typeof b === 'number' || isFloatTyped(b);
    if (aIsNum && bIsNum) {
      const an = rawNum(a as ArduinoNum);
      const bn = rawNum(b as ArduinoNum);
      return an < bn ? -1 : an > bn ? 1 : 0;
    }
    if (typeof a === 'string' && typeof b === 'string') {
      return a < b ? -1 : a > b ? 1 : 0;
    }
    if (typeof a === 'boolean' || typeof b === 'boolean') {
      const ai = this.isTruthy(a) ? 1 : 0;
      const bi = this.isTruthy(b) ? 1 : 0;
      return ai - bi;
    }
    throw new RuntimeError(line, 'Cannot compare these values');
  }

  /** Konversi nilai ke teks (dipakai untuk String + dan String()). */
  private stringify(value: unknown): string {
    if (value === undefined || value === null) return '';
    if (typeof value === 'boolean') return value ? '1' : '0'; // Perilaku Arduino.
    if (isFloatTyped(value)) return value.value.toFixed(2); // Arduino menampilkan float dengan 2 desimal.
    if (typeof value === 'number') return String(value);
    if (value instanceof StructInstance) return value.toString();
    return String(value);
  }

  /**
   * Format argumen Serial.print / lcd.print. Mendukung print(nilai) dan
   * print(nilai, basis), misalnya Serial.print(255, HEX) -> "FF".
   */
  private formatSerial(args: unknown[], line: number): string {
    if (args.length === 0) return '';
    const value = args[0];
    if (args.length >= 2 && typeof value === 'number') {
      const base = this.asInt(args[1], line);
      if (base === 2 || base === 8 || base === 16) {
        return value.toString(base).toUpperCase();
      }
    }
    // print(float, digit) -> jumlah desimal khusus.
    if (args.length >= 2 && isFloatTyped(value) && typeof args[1] === 'number') {
      return value.value.toFixed(args[1] as number);
    }
    return this.stringify(value);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
