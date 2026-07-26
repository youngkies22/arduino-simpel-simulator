/**
 * Kelas dasar untuk semua node Abstract Syntax Tree (AST).
 * Port 1:1 dari `ast_node.dart`.
 */

/** Kelas dasar semua node AST. Menyimpan `line` agar error runtime bisa menunjuk baris tepat. */
export abstract class AstNode {
  readonly line: number;
  protected constructor(line: number) {
    this.line = line;
  }
}

/** Kelas dasar untuk semua node ekspresi (menghasilkan nilai). */
export abstract class Expr extends AstNode {
  protected constructor(line: number) {
    super(line);
  }
}

/** Kelas dasar untuk semua node statement (tidak menghasilkan nilai). */
export abstract class Stmt extends AstNode {
  protected constructor(line: number) {
    super(line);
  }
}
