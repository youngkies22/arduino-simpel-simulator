/**
 * Semua node AST berjenis statement (perintah/alur program).
 * Port 1:1 dari `statements.dart`. Catatan: field Dart `arguments` diberi nama
 * `args` di sini (konsisten dengan expressions.ts) untuk menghindari ambiguitas
 * dengan `arguments` bawaan JS di dalam method biasa.
 */
import { Expr, Stmt } from './astNode';

/**
 * Satu deklarator dalam deklarasi variabel.
 * Contoh pada `int a = 1, b;` ada dua deklarator: (a, 1) dan (b, undefined).
 */
export class VarDeclarator {
  readonly name: string;
  /** Ekspresi inisialisasi skalar (undefined jika tidak ada). */
  readonly initializer?: Expr;
  /** Ukuran tiap dimensi array (`int m[2][3]` -> dua entri). Kosong = bukan array. Entri boleh undefined (`int a[] = {...}`). */
  readonly arraySizes: (Expr | undefined)[];
  /** Inisialisasi array literal, bisa bersarang: tiap elemen Expr (nilai) atau array (dimensi dalam). */
  readonly arrayInit?: ArrayInitElement[];

  constructor(
    name: string,
    opts: { initializer?: Expr; arraySizes?: (Expr | undefined)[]; arrayInit?: ArrayInitElement[] } = {},
  ) {
    this.name = name;
    this.initializer = opts.initializer;
    this.arraySizes = opts.arraySizes ?? [];
    this.arrayInit = opts.arrayInit;
  }
}

export type ArrayInitElement = Expr | ArrayInitElement[];

/** Deklarasi variabel: `int x = 5;` atau `float a, b = 2.5;`. */
export class VarDeclStmt extends Stmt {
  /** Nama tipe data ('int', 'float', 'String', 'Servo', ...). */
  readonly type: string;
  readonly declarators: VarDeclarator[];
  constructor(line: number, type: string, declarators: VarDeclarator[]) {
    super(line);
    this.type = type;
    this.declarators = declarators;
  }
}

/** Statement ekspresi: pemanggilan fungsi atau penugasan diikuti ';'. */
export class ExpressionStmt extends Stmt {
  readonly expression: Expr;
  constructor(line: number, expression: Expr) {
    super(line);
    this.expression = expression;
  }
}

/** Blok statement dalam kurung kurawal `{ ... }`. */
export class BlockStmt extends Stmt {
  readonly statements: Stmt[];
  constructor(line: number, statements: Stmt[]) {
    super(line);
    this.statements = statements;
  }
}

/** Percabangan if / else if / else. */
export class IfStmt extends Stmt {
  readonly condition: Expr;
  readonly thenBranch: Stmt;
  /** Cabang else (bisa berupa IfStmt lain untuk `else if`), undefined jika tak ada. */
  readonly elseBranch?: Stmt;
  constructor(line: number, condition: Expr, thenBranch: Stmt, elseBranch?: Stmt) {
    super(line);
    this.condition = condition;
    this.thenBranch = thenBranch;
    this.elseBranch = elseBranch;
  }
}

/** Satu `case` di dalam switch. */
export class SwitchCase {
  /** Nilai case (undefined menandakan `default`). */
  readonly value?: Expr;
  readonly body: Stmt[];
  constructor(value: Expr | undefined, body: Stmt[]) {
    this.value = value;
    this.body = body;
  }
}

/** Statement switch-case. */
export class SwitchStmt extends Stmt {
  readonly expression: Expr;
  readonly cases: SwitchCase[];
  constructor(line: number, expression: Expr, cases: SwitchCase[]) {
    super(line);
    this.expression = expression;
    this.cases = cases;
  }
}

/** Perulangan while. */
export class WhileStmt extends Stmt {
  readonly condition: Expr;
  readonly body: Stmt;
  constructor(line: number, condition: Expr, body: Stmt) {
    super(line);
    this.condition = condition;
    this.body = body;
  }
}

/** Perulangan do-while. */
export class DoWhileStmt extends Stmt {
  readonly body: Stmt;
  readonly condition: Expr;
  constructor(line: number, body: Stmt, condition: Expr) {
    super(line);
    this.body = body;
    this.condition = condition;
  }
}

/** Perulangan for klasik: `for (init; cond; update) body`. */
export class ForStmt extends Stmt {
  readonly initializer?: Stmt;
  readonly condition?: Expr;
  readonly update?: Expr;
  readonly body: Stmt;
  constructor(line: number, initializer: Stmt | undefined, condition: Expr | undefined, update: Expr | undefined, body: Stmt) {
    super(line);
    this.initializer = initializer;
    this.condition = condition;
    this.update = update;
    this.body = body;
  }
}

/** Statement `break;`. */
export class BreakStmt extends Stmt {
  constructor(line: number) {
    super(line);
  }
}

/** Statement `continue;`. */
export class ContinueStmt extends Stmt {
  constructor(line: number) {
    super(line);
  }
}

/** Statement `return;` atau `return nilai;`. */
export class ReturnStmt extends Stmt {
  readonly value?: Expr;
  constructor(line: number, value?: Expr) {
    super(line);
    this.value = value;
  }
}

/** Satu parameter fungsi: tipe + nama. */
export class FunctionParam {
  readonly type: string;
  readonly name: string;
  constructor(type: string, name: string) {
    this.type = type;
    this.name = name;
  }
}

/** Deklarasi fungsi: `void setup() { ... }` atau fungsi buatan user. */
export class FunctionDecl extends Stmt {
  readonly returnType: string;
  readonly name: string;
  readonly params: FunctionParam[];
  readonly body: BlockStmt;
  constructor(line: number, returnType: string, name: string, params: FunctionParam[], body: BlockStmt) {
    super(line);
    this.returnType = returnType;
    this.name = name;
    this.params = params;
    this.body = body;
  }
}

/**
 * Deklarasi objek hardware dengan argumen konstruktor.
 * Contoh: `LiquidCrystal lcd(12, 11, 5, 4, 3, 2);`
 */
export class ObjectDeclStmt extends Stmt {
  /** Nama kelas ('Servo', 'LiquidCrystal', dst). */
  readonly className: string;
  readonly name: string;
  readonly args: Expr[];
  constructor(line: number, className: string, name: string, args: Expr[]) {
    super(line);
    this.className = className;
    this.name = name;
    this.args = args;
  }
}

/** Satu field pada deklarasi struct. */
export class StructField {
  readonly type: string;
  readonly name: string;
  /** Ukuran array jika field berupa array (undefined = skalar). */
  readonly arraySize?: Expr;
  constructor(type: string, name: string, arraySize?: Expr) {
    this.type = type;
    this.name = name;
    this.arraySize = arraySize;
  }
}

/** Deklarasi struct: `struct Point { int x; int y; };` */
export class StructDeclStmt extends Stmt {
  readonly name: string;
  readonly fields: StructField[];
  constructor(line: number, name: string, fields: StructField[]) {
    super(line);
    this.name = name;
    this.fields = fields;
  }
}

/** Satu entri enum: nama + nilai eksplisit (opsional). */
export class EnumEntry {
  readonly name: string;
  readonly value?: Expr;
  constructor(name: string, value?: Expr) {
    this.name = name;
    this.value = value;
  }
}

/** Deklarasi enum: `enum Mode { OFF, ON = 5, AUTO };` Semua entri menjadi konstanta int global. */
export class EnumDeclStmt extends Stmt {
  /** Nama enum (boleh undefined untuk enum anonim). */
  readonly name?: string;
  readonly entries: EnumEntry[];
  constructor(line: number, name: string | undefined, entries: EnumEntry[]) {
    super(line);
    this.name = name;
    this.entries = entries;
  }
}

/** Deklarasi typedef: `typedef unsigned long ulong;` alias diperlakukan sebagai nama lain dari baseType. */
export class TypedefStmt extends Stmt {
  readonly baseType: string;
  readonly alias: string;
  constructor(line: number, baseType: string, alias: string) {
    super(line);
    this.baseType = baseType;
    this.alias = alias;
  }
}

/** Akar AST: seluruh program hasil parsing. */
export class Program {
  /** Semua deklarasi level atas: variabel global, objek, dan fungsi. */
  readonly declarations: Stmt[];
  constructor(declarations: Stmt[]) {
    this.declarations = declarations;
  }
}
