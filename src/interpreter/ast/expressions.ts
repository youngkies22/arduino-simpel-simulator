/**
 * Semua node AST berjenis ekspresi (menghasilkan nilai).
 * Port 1:1 dari `expressions.dart`.
 */
import { Expr } from './astNode';

/** Literal: angka, string, char, atau bool. Contoh: `123`, `1.5`, `"halo"`, `'a'`, `true`. */
export class LiteralExpr extends Expr {
  readonly value: unknown;
  constructor(line: number, value: unknown) {
    super(line);
    this.value = value;
  }
}

/** Referensi ke variabel/konstanta berdasarkan nama. Contoh: `x`, `HIGH`, `A0`, `LED_BUILTIN`. */
export class VariableExpr extends Expr {
  readonly name: string;
  constructor(line: number, name: string) {
    super(line);
    this.name = name;
  }
}

/** Ekspresi dalam tanda kurung: `(a + b)`. */
export class GroupingExpr extends Expr {
  readonly expression: Expr;
  constructor(line: number, expression: Expr) {
    super(line);
    this.expression = expression;
  }
}

/** Operasi biner: `a + b`, `a == b`, `a && b`, dst. */
export class BinaryExpr extends Expr {
  readonly left: Expr;
  /** Lexeme operator, misal '+', '==', '&&'. */
  readonly operator: string;
  readonly right: Expr;
  constructor(line: number, left: Expr, operator: string, right: Expr) {
    super(line);
    this.left = left;
    this.operator = operator;
    this.right = right;
  }
}

/** Operasi unary prefix: `-a`, `!a`, `~a`, `++a`, `--a`. */
export class UnaryExpr extends Expr {
  readonly operator: string;
  readonly operand: Expr;
  constructor(line: number, operator: string, operand: Expr) {
    super(line);
    this.operator = operator;
    this.operand = operand;
  }
}

/** Operasi postfix: `a++`, `a--`. */
export class PostfixExpr extends Expr {
  readonly operand: Expr;
  readonly operator: string;
  constructor(line: number, operand: Expr, operator: string) {
    super(line);
    this.operand = operand;
    this.operator = operator;
  }
}

/** Penugasan nilai: `x = 5`, `x += 2`, `arr[i] = 1`. */
export class AssignExpr extends Expr {
  /** Target penugasan (VariableExpr atau IndexExpr). */
  readonly target: Expr;
  /** Operator penugasan: '=', '+=', '-=', '*=', '/=', '%='. */
  readonly operator: string;
  readonly value: Expr;
  constructor(line: number, target: Expr, operator: string, value: Expr) {
    super(line);
    this.target = target;
    this.operator = operator;
    this.value = value;
  }
}

/** Ekspresi ternary/kondisional: `kondisi ? a : b`. */
export class TernaryExpr extends Expr {
  readonly condition: Expr;
  readonly thenBranch: Expr;
  readonly elseBranch: Expr;
  constructor(line: number, condition: Expr, thenBranch: Expr, elseBranch: Expr) {
    super(line);
    this.condition = condition;
    this.thenBranch = thenBranch;
    this.elseBranch = elseBranch;
  }
}

/** Pemanggilan fungsi biasa: `digitalWrite(13, HIGH)`, `myFunc(a, b)`. */
export class CallExpr extends Expr {
  readonly name: string;
  readonly args: Expr[];
  constructor(line: number, name: string, args: Expr[]) {
    super(line);
    this.name = name;
    this.args = args;
  }
}

/** Pemanggilan method pada objek: `Serial.println(x)`, `servo.write(90)`. */
export class MethodCallExpr extends Expr {
  /** Ekspresi objek pemilik method (biasanya VariableExpr). */
  readonly target: Expr;
  readonly method: string;
  readonly args: Expr[];
  constructor(line: number, target: Expr, method: string, args: Expr[]) {
    super(line);
    this.target = target;
    this.method = method;
    this.args = args;
  }
}

/** Akses elemen array: `arr[i]`. */
export class IndexExpr extends Expr {
  readonly target: Expr;
  readonly index: Expr;
  constructor(line: number, target: Expr, index: Expr) {
    super(line);
    this.target = target;
    this.index = index;
  }
}

/** Akses field/anggota struct tanpa pemanggilan: `titik.x`. */
export class MemberExpr extends Expr {
  readonly target: Expr;
  readonly member: string;
  constructor(line: number, target: Expr, member: string) {
    super(line);
    this.target = target;
    this.member = member;
  }
}
