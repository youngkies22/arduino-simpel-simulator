/**
 * Parser recursive-descent: mengubah daftar token menjadi AST.
 * Port 1:1 dari `arduino_parser.dart`.
 *
 * Mendukung: deklarasi variabel & fungsi, objek hardware (Servo,
 * LiquidCrystal), if/else, switch, for, while, do-while, break, continue,
 * return, serta ekspresi lengkap (aritmatika, perbandingan, logika, ternary,
 * penugasan, pemanggilan fungsi & method).
 */
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
  type ArrayInitElement,
  BlockStmt,
  BreakStmt,
  ContinueStmt,
  DoWhileStmt,
  EnumDeclStmt,
  EnumEntry,
  ExpressionStmt,
  ForStmt,
  FunctionDecl,
  FunctionParam,
  IfStmt,
  ObjectDeclStmt,
  Program,
  ReturnStmt,
  StructDeclStmt,
  StructField,
  SwitchCase,
  SwitchStmt,
  TypedefStmt,
  VarDeclarator,
  VarDeclStmt,
  WhileStmt,
} from './ast/statements';
import { ArduinoSyntaxError } from './syntaxError';
import { Token, type TokenType } from './token';

/** Kelas objek hardware yang dideklarasikan dengan konstruktor, misal `Servo s;`. */
const OBJECT_CLASSES = new Set([
  'Servo',
  'LiquidCrystal',
  'LiquidCrystal_I2C',
  'DHT',
  'Stepper',
  'MFRC522',
]);

const MODIFIERS = new Set(['const', 'static', 'unsigned', 'signed', 'volatile']);

/** Parser recursive-descent untuk bahasa Arduino/C++ subset. */
export class ArduinoParser {
  private readonly tokens: Token[];
  private current = 0;

  constructor(tokens: Token[]) {
    this.tokens = ArduinoParser.promoteUserTypes(tokens);
  }

  /**
   * Pre-pass: cari nama tipe buatan user (struct/enum/typedef), lalu ubah
   * semua token identifier bernama sama menjadi token bertipe 'type' agar
   * deklarasi `Point p;` dikenali.
   */
  private static promoteUserTypes(tokens: Token[]): Token[] {
    const userTypes = new Set<string>();
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.type !== 'keyword') continue;
      // struct Nama { ... }  /  enum Nama { ... }
      if (
        (t.lexeme === 'struct' || t.lexeme === 'enum') &&
        i + 2 < tokens.length &&
        tokens[i + 1].type === 'identifier' &&
        tokens[i + 2].type === 'leftBrace'
      ) {
        userTypes.add(tokens[i + 1].lexeme);
      }
      // typedef ... alias ;  -> token tepat sebelum ';' adalah alias.
      if (t.lexeme === 'typedef') {
        let j = i + 1;
        while (j < tokens.length && tokens[j].type !== 'semicolon' && tokens[j].type !== 'eof') {
          j++;
        }
        if (j - 1 > i && tokens[j - 1].type === 'identifier') {
          userTypes.add(tokens[j - 1].lexeme);
        }
      }
    }
    if (userTypes.size === 0) return tokens;
    return tokens.map((t) =>
      t.type === 'identifier' && userTypes.has(t.lexeme)
        ? new Token({ type: 'type', lexeme: t.lexeme, literal: t.literal, line: t.line })
        : t,
    );
  }

  /** Mem-parsing seluruh token menjadi Program. Melempar ArduinoSyntaxError jika ada kesalahan sintaks. */
  parseProgram(): Program {
    const declarations: Stmt[] = [];
    while (!this.isAtEnd) {
      declarations.push(this.topLevelDeclaration());
    }
    return new Program(declarations);
  }

  // ==========================================================
  // DEKLARASI LEVEL ATAS (global var, fungsi, objek hardware)
  // ==========================================================

  private topLevelDeclaration(): Stmt {
    if (this.check('keyword')) {
      switch (this.peek().lexeme) {
        case 'struct':
          return this.structDeclaration();
        case 'enum':
          return this.enumDeclaration();
        case 'typedef':
          return this.typedefDeclaration();
      }
    }

    this.skipModifiers();

    if (this.check('type')) {
      const typeToken = this.advance();
      const typeName = typeToken.lexeme;

      const nameToken = this.expect('identifier', `Expected name after '${typeName}'`);

      // --- Objek hardware: Servo s; / LiquidCrystal lcd(...); dll ---
      if (OBJECT_CLASSES.has(typeName)) {
        const args: Expr[] = [];
        if (this.match('leftParen')) {
          if (!this.check('rightParen')) {
            do {
              args.push(this.expression());
            } while (this.match('comma'));
          }
          this.expect('rightParen', "Missing ')'");
        }
        this.expect('semicolon', "Missing ';'");
        return new ObjectDeclStmt(typeToken.line, typeName, nameToken.lexeme, args);
      }

      // --- Fungsi: tipe nama(...) { ... } ---
      if (this.check('leftParen')) {
        return this.functionDeclaration(typeToken, nameToken);
      }

      // --- Variabel global: tipe nama = nilai; ---
      return this.finishVarDecl(typeToken, nameToken);
    }

    throw new ArduinoSyntaxError(this.peek().line, `Unexpected token '${this.peek().lexeme}' (expected declaration)`);
  }

  /** struct Nama { tipe field; ... }; */
  private structDeclaration(): Stmt {
    const t = this.advance(); // konsumsi 'struct'
    const nameToken = this.check('type') ? this.advance() : this.expect('identifier', 'Expected struct name');
    this.expect('leftBrace', "Missing '{'");

    const fields: StructField[] = [];
    while (!this.check('rightBrace') && !this.isAtEnd) {
      this.skipModifiers();
      const fieldType = this.expect('type', 'Expected field type');
      const fieldName = this.expect('identifier', 'Expected field name');
      let arraySize: Expr | undefined;
      if (this.match('leftBracket')) {
        arraySize = this.expression();
        this.expect('rightBracket', "Missing ']'");
      }
      this.expect('semicolon', "Missing ';'");
      fields.push(new StructField(fieldType.lexeme, fieldName.lexeme, arraySize));
    }
    this.expect('rightBrace', "Missing '}'");
    this.expect('semicolon', "Missing ';'");
    return new StructDeclStmt(t.line, nameToken.lexeme, fields);
  }

  /** enum Nama { A, B = 2, C };  (nama boleh kosong) */
  private enumDeclaration(): Stmt {
    const t = this.advance(); // konsumsi 'enum'
    let name: string | undefined;
    if (this.check('type') || this.check('identifier')) {
      name = this.advance().lexeme;
    }
    this.expect('leftBrace', "Missing '{'");

    const entries: EnumEntry[] = [];
    if (!this.check('rightBrace')) {
      do {
        if (this.check('rightBrace')) break; // koma di akhir.
        const entryName = this.expect('identifier', 'Expected enum entry name');
        let value: Expr | undefined;
        if (this.match('assign')) value = this.expression();
        entries.push(new EnumEntry(entryName.lexeme, value));
      } while (this.match('comma'));
    }
    this.expect('rightBrace', "Missing '}'");
    this.expect('semicolon', "Missing ';'");
    return new EnumDeclStmt(t.line, name, entries);
  }

  /** `typedef [modifier] tipeDasar alias;` */
  private typedefDeclaration(): Stmt {
    const t = this.advance(); // konsumsi 'typedef'
    this.skipModifiers();
    const base = this.expect('type', 'Expected base type');
    const alias = this.check('type') ? this.advance() : this.expect('identifier', 'Expected typedef alias');
    this.expect('semicolon', "Missing ';'");
    return new TypedefStmt(t.line, base.lexeme, alias.lexeme);
  }

  /** Melanjutkan parsing deklarasi fungsi setelah tipe & nama terbaca. */
  private functionDeclaration(typeToken: Token, nameToken: Token): Stmt {
    this.expect('leftParen', "Missing '('");
    const params: FunctionParam[] = [];
    if (!this.check('rightParen')) {
      do {
        this.skipModifiers();
        const paramType = this.expect('type', 'Expected parameter type');
        const paramName = this.expect('identifier', 'Expected parameter name');
        params.push(new FunctionParam(paramType.lexeme, paramName.lexeme));
      } while (this.match('comma'));
    }
    this.expect('rightParen', "Missing ')'");
    const brace = this.expect('leftBrace', "Missing '{'");
    const body = this.blockAfterBrace(brace);
    return new FunctionDecl(typeToken.line, typeToken.lexeme, nameToken.lexeme, params, body);
  }

  /**
   * Melanjutkan parsing deklarasi variabel setelah tipe & nama pertama.
   * Mendukung banyak deklarator (`int a = 1, b;`), array 1D/2D/multi
   * (`int m[2][3]`), dan initializer bersarang (`{{1,2},{3,4}}`).
   */
  private finishVarDecl(typeToken: Token, firstName: Token): Stmt {
    const declarators: VarDeclarator[] = [];
    let name = firstName;
    for (;;) {
      const arraySizes: (Expr | undefined)[] = [];
      let arrayInit: ArrayInitElement[] | undefined;
      let initializer: Expr | undefined;

      while (this.match('leftBracket')) {
        if (!this.check('rightBracket')) {
          arraySizes.push(this.expression());
        } else {
          arraySizes.push(undefined); // `int a[] = {...}`
        }
        this.expect('rightBracket', "Missing ']'");
      }

      if (this.match('assign')) {
        if (this.check('leftBrace')) {
          this.advance(); // konsumsi '{'
          arrayInit = this.braceInitList();
        } else {
          initializer = this.expression();
        }
      }

      declarators.push(new VarDeclarator(name.lexeme, { initializer, arraySizes, arrayInit }));

      if (this.match('comma')) {
        name = this.expect('identifier', 'Expected variable name');
        continue;
      }
      break;
    }
    this.expect('semicolon', "Missing ';'");
    return new VarDeclStmt(typeToken.line, typeToken.lexeme, declarators);
  }

  /** Mem-parsing isi initializer `{...}` setelah '{' dikonsumsi. */
  private braceInitList(): ArrayInitElement[] {
    const items: ArrayInitElement[] = [];
    if (!this.check('rightBrace')) {
      do {
        if (this.check('rightBrace')) break; // koma di akhir.
        if (this.match('leftBrace')) {
          items.push(this.braceInitList()); // Dimensi dalam.
        } else {
          items.push(this.expression());
        }
      } while (this.match('comma'));
    }
    this.expect('rightBrace', "Missing '}'");
    return items;
  }

  // ==========================================================
  // STATEMENT
  // ==========================================================

  private statement(): Stmt {
    // Modifier di depan deklarasi lokal (const int x = ...).
    if (this.checkModifier()) {
      this.skipModifiers();
      const typeToken = this.expect('type', 'Expected type');
      const nameToken = this.expect('identifier', 'Expected variable name');
      return this.finishVarDecl(typeToken, nameToken);
    }

    if (this.check('type')) {
      const typeToken = this.advance();
      const nameToken = this.expect('identifier', 'Expected variable name');
      return this.finishVarDecl(typeToken, nameToken);
    }

    if (this.check('leftBrace')) {
      const brace = this.advance();
      return this.blockAfterBrace(brace);
    }

    if (this.check('keyword')) {
      switch (this.peek().lexeme) {
        case 'struct':
          return this.structDeclaration();
        case 'enum':
          return this.enumDeclaration();
        case 'typedef':
          return this.typedefDeclaration();
        case 'if':
          return this.ifStatement();
        case 'switch':
          return this.switchStatement();
        case 'while':
          return this.whileStatement();
        case 'do':
          return this.doWhileStatement();
        case 'for':
          return this.forStatement();
        case 'break': {
          const t = this.advance();
          this.expect('semicolon', "Missing ';'");
          return new BreakStmt(t.line);
        }
        case 'continue': {
          const t = this.advance();
          this.expect('semicolon', "Missing ';'");
          return new ContinueStmt(t.line);
        }
        case 'return': {
          const t = this.advance();
          let value: Expr | undefined;
          if (!this.check('semicolon')) {
            value = this.expression();
          }
          this.expect('semicolon', "Missing ';'");
          return new ReturnStmt(t.line, value);
        }
      }
    }

    // Statement kosong ';'.
    if (this.match('semicolon')) {
      return new BlockStmt(this.previous.line, []);
    }

    const expr = this.expression();
    this.expect('semicolon', "Missing ';'");
    return new ExpressionStmt(expr.line, expr);
  }

  /** Mem-parsing isi blok setelah '{' terbaca. */
  private blockAfterBrace(brace: Token): BlockStmt {
    const statements: Stmt[] = [];
    while (!this.check('rightBrace') && !this.isAtEnd) {
      statements.push(this.statement());
    }
    this.expect('rightBrace', "Missing '}'");
    return new BlockStmt(brace.line, statements);
  }

  /** if (kondisi) then [else else-branch] */
  private ifStatement(): Stmt {
    const t = this.advance(); // konsumsi 'if'
    this.expect('leftParen', "Missing '(' after 'if'");
    const condition = this.expression();
    this.expect('rightParen', "Missing ')'");
    const thenBranch = this.statement();
    let elseBranch: Stmt | undefined;
    if (this.check('keyword') && this.peek().lexeme === 'else') {
      this.advance(); // konsumsi 'else'
      elseBranch = this.statement();
    }
    return new IfStmt(t.line, condition, thenBranch, elseBranch);
  }

  /** switch (ekspresi) { case nilai: ... default: ... } */
  private switchStatement(): Stmt {
    const t = this.advance(); // konsumsi 'switch'
    this.expect('leftParen', "Missing '(' after 'switch'");
    const expr = this.expression();
    this.expect('rightParen', "Missing ')'");
    this.expect('leftBrace', "Missing '{'");

    const cases: SwitchCase[] = [];
    while (!this.check('rightBrace') && !this.isAtEnd) {
      let caseValue: Expr | undefined;
      if (this.check('keyword') && this.peek().lexeme === 'case') {
        this.advance(); // konsumsi 'case'
        caseValue = this.expression();
      } else if (this.check('keyword') && this.peek().lexeme === 'default') {
        this.advance(); // konsumsi 'default'; caseValue tetap undefined.
      } else {
        throw new ArduinoSyntaxError(this.peek().line, `Unexpected token '${this.peek().lexeme}' in switch`);
      }
      this.expect('colon', "Missing ':'");

      const body: Stmt[] = [];
      while (
        !this.isAtEnd &&
        !this.check('rightBrace') &&
        !(this.check('keyword') && (this.peek().lexeme === 'case' || this.peek().lexeme === 'default'))
      ) {
        body.push(this.statement());
      }
      cases.push(new SwitchCase(caseValue, body));
    }
    this.expect('rightBrace', "Missing '}'");
    return new SwitchStmt(t.line, expr, cases);
  }

  /** while (kondisi) body */
  private whileStatement(): Stmt {
    const t = this.advance(); // konsumsi 'while'
    this.expect('leftParen', "Missing '(' after 'while'");
    const condition = this.expression();
    this.expect('rightParen', "Missing ')'");
    const body = this.statement();
    return new WhileStmt(t.line, condition, body);
  }

  /** do body while (kondisi); */
  private doWhileStatement(): Stmt {
    const t = this.advance(); // konsumsi 'do'
    const body = this.statement();
    if (!(this.check('keyword') && this.peek().lexeme === 'while')) {
      throw new ArduinoSyntaxError(this.peek().line, "Missing 'while' after do-block");
    }
    this.advance(); // konsumsi 'while'
    this.expect('leftParen', "Missing '('");
    const condition = this.expression();
    this.expect('rightParen', "Missing ')'");
    this.expect('semicolon', "Missing ';'");
    return new DoWhileStmt(t.line, body, condition);
  }

  /** for (init; kondisi; update) body */
  private forStatement(): Stmt {
    const t = this.advance(); // konsumsi 'for'
    this.expect('leftParen', "Missing '(' after 'for'");

    let initializer: Stmt | undefined;
    if (this.match('semicolon')) {
      initializer = undefined;
    } else if (this.check('type') || this.checkModifier()) {
      this.skipModifiers();
      const typeToken = this.expect('type', 'Expected type');
      const nameToken = this.expect('identifier', 'Expected variable name');
      initializer = this.finishVarDecl(typeToken, nameToken); // konsumsi ';'
    } else {
      const expr = this.expression();
      this.expect('semicolon', "Missing ';'");
      initializer = new ExpressionStmt(expr.line, expr);
    }

    let condition: Expr | undefined;
    if (!this.check('semicolon')) {
      condition = this.expression();
    }
    this.expect('semicolon', "Missing ';'");

    let update: Expr | undefined;
    if (!this.check('rightParen')) {
      update = this.expression();
    }
    this.expect('rightParen', "Missing ')'");

    const body = this.statement();
    return new ForStmt(t.line, initializer, condition, update, body);
  }

  // ==========================================================
  // EKSPRESI (diurutkan dari precedence terendah ke tertinggi)
  // ==========================================================

  private expression(): Expr {
    return this.assignment();
  }

  /** Penugasan: `target = nilai`, `target += nilai`, dst. */
  private assignment(): Expr {
    const expr = this.ternary();

    if (
      this.check('assign') ||
      this.check('plusAssign') ||
      this.check('minusAssign') ||
      this.check('starAssign') ||
      this.check('slashAssign') ||
      this.check('percentAssign')
    ) {
      const op = this.advance();
      const value = this.assignment(); // asosiatif kanan.
      if (expr instanceof VariableExpr || expr instanceof IndexExpr || expr instanceof MemberExpr) {
        return new AssignExpr(op.line, expr, op.lexeme, value);
      }
      throw new ArduinoSyntaxError(op.line, 'Invalid assignment target');
    }
    return expr;
  }

  /** Ternary: `kondisi ? a : b`. */
  private ternary(): Expr {
    const condition = this.logicalOr();
    if (this.match('question')) {
      const thenBranch = this.expression();
      this.expect('colon', "Missing ':'");
      const elseBranch = this.expression();
      return new TernaryExpr(condition.line, condition, thenBranch, elseBranch);
    }
    return condition;
  }

  private logicalOr(): Expr {
    let expr = this.logicalAnd();
    while (this.check('or')) {
      const op = this.advance();
      const right = this.logicalAnd();
      expr = new BinaryExpr(op.line, expr, op.lexeme, right);
    }
    return expr;
  }

  private logicalAnd(): Expr {
    let expr = this.bitwiseOr();
    while (this.check('and')) {
      const op = this.advance();
      const right = this.bitwiseOr();
      expr = new BinaryExpr(op.line, expr, op.lexeme, right);
    }
    return expr;
  }

  private bitwiseOr(): Expr {
    let expr = this.bitwiseXor();
    while (this.check('bitOr')) {
      const op = this.advance();
      expr = new BinaryExpr(op.line, expr, op.lexeme, this.bitwiseXor());
    }
    return expr;
  }

  private bitwiseXor(): Expr {
    let expr = this.bitwiseAnd();
    while (this.check('bitXor')) {
      const op = this.advance();
      expr = new BinaryExpr(op.line, expr, op.lexeme, this.bitwiseAnd());
    }
    return expr;
  }

  private bitwiseAnd(): Expr {
    let expr = this.equality();
    while (this.check('bitAnd')) {
      const op = this.advance();
      expr = new BinaryExpr(op.line, expr, op.lexeme, this.equality());
    }
    return expr;
  }

  private equality(): Expr {
    let expr = this.comparison();
    while (this.check('equal') || this.check('notEqual')) {
      const op = this.advance();
      expr = new BinaryExpr(op.line, expr, op.lexeme, this.comparison());
    }
    return expr;
  }

  private comparison(): Expr {
    let expr = this.shift();
    while (this.check('greater') || this.check('less') || this.check('greaterEqual') || this.check('lessEqual')) {
      const op = this.advance();
      expr = new BinaryExpr(op.line, expr, op.lexeme, this.shift());
    }
    return expr;
  }

  private shift(): Expr {
    let expr = this.additive();
    while (this.check('shiftLeft') || this.check('shiftRight')) {
      const op = this.advance();
      expr = new BinaryExpr(op.line, expr, op.lexeme, this.additive());
    }
    return expr;
  }

  private additive(): Expr {
    let expr = this.multiplicative();
    while (this.check('plus') || this.check('minus')) {
      const op = this.advance();
      expr = new BinaryExpr(op.line, expr, op.lexeme, this.multiplicative());
    }
    return expr;
  }

  private multiplicative(): Expr {
    let expr = this.unary();
    while (this.check('star') || this.check('slash') || this.check('percent')) {
      const op = this.advance();
      expr = new BinaryExpr(op.line, expr, op.lexeme, this.unary());
    }
    return expr;
  }

  /** Unary prefix: `-a`, `!a`, `~a`, `+a`, `++a`, `--a`. */
  private unary(): Expr {
    if (
      this.check('minus') ||
      this.check('not') ||
      this.check('bitNot') ||
      this.check('plus') ||
      this.check('plusPlus') ||
      this.check('minusMinus')
    ) {
      const op = this.advance();
      const operand = this.unary();
      return new UnaryExpr(op.line, op.lexeme, operand);
    }
    return this.postfix();
  }

  /** Postfix: pemanggilan fungsi, method, indeks array, `++`, `--`. */
  private postfix(): Expr {
    let expr = this.primary();

    for (;;) {
      if (this.check('leftParen') && expr instanceof VariableExpr) {
        const callee = expr;
        this.advance(); // konsumsi '('
        const args = this.argumentList();
        expr = new CallExpr(callee.line, callee.name, args);
      } else if (this.match('dot')) {
        const nameToken = this.expect('identifier', "Expected member name after '.'");
        if (this.match('leftParen')) {
          const args = this.argumentList();
          expr = new MethodCallExpr(nameToken.line, expr, nameToken.lexeme, args);
        } else {
          expr = new MemberExpr(nameToken.line, expr, nameToken.lexeme);
        }
      } else if (this.match('leftBracket')) {
        const index = this.expression();
        this.expect('rightBracket', "Missing ']'");
        expr = new IndexExpr(expr.line, expr, index);
      } else if (this.check('plusPlus') || this.check('minusMinus')) {
        const op = this.advance();
        expr = new PostfixExpr(op.line, expr, op.lexeme);
      } else {
        break;
      }
    }
    return expr;
  }

  /**
   * Mem-parsing daftar argumen sampai ')' (kurung buka sudah dikonsumsi).
   * Memberi pesan "Missing ','" jika dua argumen tidak dipisah koma.
   */
  private argumentList(): Expr[] {
    const args: Expr[] = [];
    if (!this.check('rightParen')) {
      for (;;) {
        args.push(this.expression());
        if (this.match('comma')) continue;
        if (this.check('rightParen')) break;
        throw new ArduinoSyntaxError(this.peek().line, "Missing ','");
      }
    }
    this.expect('rightParen', "Missing ')'");
    return args;
  }

  /** Ekspresi paling dasar: literal, variabel, atau grup kurung. */
  private primary(): Expr {
    const token = this.peek();

    switch (token.type) {
      case 'intLiteral':
      case 'floatLiteral':
      case 'stringLiteral':
      case 'charLiteral':
        this.advance();
        return new LiteralExpr(token.line, token.literal);

      case 'keyword':
        if (token.lexeme === 'true' || token.lexeme === 'false') {
          this.advance();
          return new LiteralExpr(token.line, token.lexeme === 'true');
        }
        throw new ArduinoSyntaxError(token.line, `Unexpected token '${token.lexeme}'`);

      case 'identifier':
        this.advance();
        return new VariableExpr(token.line, token.lexeme);

      case 'type': {
        // Cast gaya C++: int(x) — perlakukan sebagai pemanggilan fungsi konversi.
        this.advance();
        if (this.match('leftParen')) {
          const args = this.argumentList();
          return new CallExpr(token.line, token.lexeme, args);
        }
        throw new ArduinoSyntaxError(token.line, `Unexpected token '${token.lexeme}'`);
      }

      case 'leftParen': {
        this.advance();
        // Cast dalam kurung: (int)x -> abaikan cast, parse operand.
        if (this.check('type')) {
          const castType = this.advance();
          if (this.match('rightParen')) {
            const operand = this.unary();
            return new CallExpr(castType.line, castType.lexeme, [operand]);
          }
          throw new ArduinoSyntaxError(castType.line, "Missing ')'");
        }
        const expr = this.expression();
        this.expect('rightParen', "Missing ')'");
        return new GroupingExpr(token.line, expr);
      }

      default:
        throw new ArduinoSyntaxError(token.line, `Unexpected token '${token.lexeme}'`);
    }
  }

  // ==========================================================
  // UTILITAS TOKEN
  // ==========================================================

  private checkModifier(): boolean {
    return this.check('keyword') && MODIFIERS.has(this.peek().lexeme);
  }

  private skipModifiers(): void {
    while (this.checkModifier()) {
      this.advance();
    }
  }

  private get isAtEnd(): boolean {
    return this.peek().type === 'eof';
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private get previous(): Token {
    return this.tokens[this.current - 1];
  }

  private advance(): Token {
    if (!this.isAtEnd) this.current++;
    return this.previous;
  }

  private check(type: TokenType): boolean {
    return this.peek().type === type;
  }

  private match(type: TokenType): boolean {
    if (this.check(type)) {
      this.advance();
      return true;
    }
    return false;
  }

  private expect(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    throw new ArduinoSyntaxError(this.peek().line, message);
  }
}
