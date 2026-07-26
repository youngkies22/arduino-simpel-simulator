/**
 * Lexer (scanner): mengubah source code Arduino/C++ menjadi daftar token.
 * Komentar dan baris preprocessor (#include) dilewati, tetapi nomor baris
 * tetap dihitung dengan benar. Port 1:1 dari `lexer.dart`.
 */
import { mkFloat } from './arduinoFloat';
import { ArduinoSyntaxError } from './syntaxError';
import { Token, type TokenType } from './token';

/** Kata kunci kontrol alur yang dikenali parser. */
export const KEYWORDS = new Set([
  'if', 'else', 'switch', 'case', 'default',
  'for', 'while', 'do',
  'break', 'continue', 'return',
  'true', 'false',
  'const', 'static', 'unsigned', 'signed', 'volatile',
  'struct', 'enum', 'typedef',
]);

/** Nama tipe data yang dikenali (termasuk kelas objek hardware). */
export const TYPES = new Set([
  'void', 'int', 'long', 'short', 'byte',
  'float', 'double',
  'bool', 'boolean',
  'char', 'String', 'word',
  'Servo', 'LiquidCrystal', 'LiquidCrystal_I2C', 'DHT', 'Stepper',
  'MFRC522',
]);

const DIGIT_RE = /[0-9]/;
const HEX_DIGIT_RE = /[0-9a-fA-F]/;
const ALPHA_RE = /[a-zA-Z_]/;
const NUMBER_SUFFIX_RE = /[lLuUfF]/;

export class Lexer {
  private readonly source: string;
  private readonly tokens: Token[] = [];
  private start = 0;
  private current = 0;
  private line = 1;

  constructor(source: string) {
    this.source = source;
  }

  tokenize(): Token[] {
    while (!this.isAtEnd) {
      this.start = this.current;
      this.scanToken();
    }
    this.tokens.push(new Token({ type: 'eof', lexeme: '', line: this.line }));
    return this.tokens;
  }

  private scanToken(): void {
    const c = this.advance();
    switch (c) {
      case ' ':
      case '\r':
      case '\t':
        break;
      case '\n':
        this.line++;
        break;

      case '(': this.add('leftParen'); break;
      case ')': this.add('rightParen'); break;
      case '{': this.add('leftBrace'); break;
      case '}': this.add('rightBrace'); break;
      case '[': this.add('leftBracket'); break;
      case ']': this.add('rightBracket'); break;
      case ';': this.add('semicolon'); break;
      case ',': this.add('comma'); break;
      case ':': this.add('colon'); break;
      case '?': this.add('question'); break;
      case '~': this.add('bitNot'); break;

      case '.':
        if (this.isDigit(this.peek())) {
          this.number();
        } else {
          this.add('dot');
        }
        break;

      case '+':
        if (this.match('+')) this.add('plusPlus');
        else if (this.match('=')) this.add('plusAssign');
        else this.add('plus');
        break;
      case '-':
        if (this.match('-')) this.add('minusMinus');
        else if (this.match('=')) this.add('minusAssign');
        else this.add('minus');
        break;
      case '*':
        this.add(this.match('=') ? 'starAssign' : 'star');
        break;
      case '%':
        this.add(this.match('=') ? 'percentAssign' : 'percent');
        break;
      case '=':
        this.add(this.match('=') ? 'equal' : 'assign');
        break;
      case '!':
        this.add(this.match('=') ? 'notEqual' : 'not');
        break;
      case '&':
        this.add(this.match('&') ? 'and' : 'bitAnd');
        break;
      case '|':
        this.add(this.match('|') ? 'or' : 'bitOr');
        break;
      case '^':
        this.add('bitXor');
        break;
      case '>':
        if (this.match('=')) this.add('greaterEqual');
        else if (this.match('>')) this.add('shiftRight');
        else this.add('greater');
        break;
      case '<':
        if (this.match('=')) this.add('lessEqual');
        else if (this.match('<')) this.add('shiftLeft');
        else this.add('less');
        break;

      case '/':
        if (this.match('/')) {
          while (this.peek() !== '\n' && !this.isAtEnd) this.advance();
        } else if (this.match('*')) {
          this.blockComment();
        } else if (this.match('=')) {
          this.add('slashAssign');
        } else {
          this.add('slash');
        }
        break;

      case '#':
        while (this.peek() !== '\n' && !this.isAtEnd) this.advance();
        break;

      case '"':
        this.string();
        break;
      case "'":
        this.char();
        break;

      default:
        if (this.isDigit(c)) {
          this.number();
        } else if (this.isAlpha(c)) {
          this.identifier();
        } else {
          throw new ArduinoSyntaxError(this.line, `Unexpected character '${c}'`);
        }
    }
  }

  private blockComment(): void {
    while (!this.isAtEnd) {
      if (this.peek() === '\n') this.line++;
      if (this.peek() === '*' && this.peekNext() === '/') {
        this.advance();
        this.advance();
        return;
      }
      this.advance();
    }
    throw new ArduinoSyntaxError(this.line, 'Unterminated block comment');
  }

  private string(): void {
    let value = '';
    while (this.peek() !== '"' && !this.isAtEnd) {
      const c = this.advance();
      if (c === '\n') {
        throw new ArduinoSyntaxError(this.line, 'Unterminated string');
      }
      if (c === '\\') {
        const esc = this.advance();
        switch (esc) {
          case 'n': value += '\n'; break;
          case 't': value += '\t'; break;
          case 'r': value += '\r'; break;
          case '\\': value += '\\'; break;
          case '"': value += '"'; break;
          case "'": value += "'"; break;
          case '0': value += ' '; break;
          default: value += esc;
        }
      } else {
        value += c;
      }
    }
    if (this.isAtEnd) throw new ArduinoSyntaxError(this.line, 'Unterminated string');
    this.advance();
    this.add('stringLiteral', value);
  }

  private char(): void {
    if (this.isAtEnd) throw new ArduinoSyntaxError(this.line, 'Unterminated char literal');
    let c = this.advance();
    if (c === '\\') {
      const esc = this.advance();
      switch (esc) {
        case 'n': c = '\n'; break;
        case 't': c = '\t'; break;
        case 'r': c = '\r'; break;
        case '0': c = ' '; break;
        default: c = esc;
      }
    }
    if (this.peek() !== "'") {
      throw new ArduinoSyntaxError(this.line, "Missing closing ' for char literal");
    }
    this.advance();
    this.add('charLiteral', c.charCodeAt(0));
  }

  private number(): void {
    if (this.source[this.start] === '0' && (this.peek() === 'x' || this.peek() === 'X')) {
      this.advance();
      while (this.isHexDigit(this.peek())) this.advance();
      const hex = this.source.substring(this.start + 2, this.current);
      if (hex.length === 0) throw new ArduinoSyntaxError(this.line, 'Invalid hex number');
      this.add('intLiteral', parseInt(hex, 16));
      return;
    }

    let isFloat = this.source[this.start] === '.';
    while (this.isDigit(this.peek())) this.advance();
    if (this.peek() === '.' && this.isDigit(this.peekNext())) {
      isFloat = true;
      this.advance();
      while (this.isDigit(this.peek())) this.advance();
    }
    while (this.peek() !== '' && NUMBER_SUFFIX_RE.test(this.peek())) {
      if (this.peek() === 'f' || this.peek() === 'F') isFloat = true;
      this.advance();
    }

    const text = this.source.substring(this.start, this.current).replace(/[lLuUfF]/g, '');
    if (isFloat) {
      this.add('floatLiteral', mkFloat(parseFloat(text)));
    } else {
      this.add('intLiteral', parseInt(text, 10));
    }
  }

  private identifier(): void {
    while (this.isAlphaNumeric(this.peek())) this.advance();
    const text = this.source.substring(this.start, this.current);
    if (TYPES.has(text)) {
      this.add('type');
    } else if (KEYWORDS.has(text)) {
      this.add('keyword');
    } else {
      this.add('identifier');
    }
  }

  private get isAtEnd(): boolean {
    return this.current >= this.source.length;
  }

  private advance(): string {
    return this.source[this.current++];
  }

  private peek(): string {
    return this.isAtEnd ? '' : this.source[this.current];
  }

  private peekNext(): string {
    return this.current + 1 >= this.source.length ? '' : this.source[this.current + 1];
  }

  private match(expected: string): boolean {
    if (this.isAtEnd || this.source[this.current] !== expected) return false;
    this.current++;
    return true;
  }

  private add(type: TokenType, literal?: Token['literal']): void {
    this.tokens.push(
      new Token({
        type,
        lexeme: this.source.substring(this.start, this.current),
        literal,
        line: this.line,
      }),
    );
  }

  private isDigit(c: string): boolean {
    return c !== '' && DIGIT_RE.test(c);
  }

  private isHexDigit(c: string): boolean {
    return c !== '' && HEX_DIGIT_RE.test(c);
  }

  private isAlpha(c: string): boolean {
    return c !== '' && ALPHA_RE.test(c);
  }

  private isAlphaNumeric(c: string): boolean {
    return this.isDigit(c) || this.isAlpha(c);
  }
}
