const fs = require('fs');
const readLine = require('readline');
const filePath = process.argv[2];

class SymbolTable {
  constructor() {
    this.table = {
      SP: 0,
      LCL: 1,
      ARG: 2,
      THIS: 3,
      THAT: 4,
      R0: 0,
      R1: 1,
      R2: 2,
      R3: 3,
      R4: 4,
      R5: 5,
      R6: 6,
      R7: 7,
      R8: 8,
      R9: 9,
      R10: 10,
      R11: 11,
      R12: 12,
      R13: 13,
      R14: 14,
      R15: 15,
      SCREEN: 16384,
      KBD: 24576
    };
  }

  contains(symbol) {
    return this.table[symbol] !== undefined;
  }

  getAddress(symbol) {
    return this.table[symbol];
  }

  addEntry(symbol, index) {
    this.table[symbol] = index;
  }
}

class Parser {
  constructor(filePath) {
    const filePathArray = filePath.split('/');
    const fileName = filePathArray.pop().split('.')[0] + '.hack';

    filePathArray.push(fileName);
    const newFilePath = filePathArray.join('/');

    this.filePath = filePath
    this.fileReader = readLine.createInterface({
      input: fs.createReadStream(this.filePath)
    });
    this.writeStream = fs.createWriteStream(newFilePath);
    this.symbolTable = new SymbolTable();
  }

  parse() {
    let lineNumber = 0;
    this.fileReader.on('line', line => {
      line = line.trim();
      const type = this.commandType(line);
      let symbol;
      if (type === 'L_COMMAND') {
        symbol = this.symbol(line, type);
        this.symbolTable.addEntry(symbol, lineNumber);
      } else if (type === 'C_COMMAND' || type === 'A_COMMAND') {
        lineNumber++;
      }
    });
    return new Promise(resolve => {
      this.fileReader.on('close', () => {
        this.fileReader = readLine.createInterface({
          input: fs.createReadStream(this.filePath)
        });
        resolve();
        });
    });
  }

  compile() {
    let ramIndex = 16;
    this.fileReader.on('line', line => {
      line = line.trim();
      const type = this.commandType(line);
      let symbol;
      let address;
      let dest;
      let comp;
      let jump;
      if (type === 'A_COMMAND') {
        symbol = this.symbol(line, type);
        if (!isNaN(Number(symbol))) {
          address = Number(symbol);
        } else {
          if (!this.symbolTable.contains(symbol)) {
            if (ramIndex === 16384 || ramIndex === 24576) {
              ramIndex++;
            }
            this.symbolTable.addEntry(symbol, ramIndex++);
          }
          address = this.symbolTable.getAddress(symbol);
        }
        this.writeStream.write(`${this.toBinary(type, address, dest, comp, jump)}\n`);
      } else if (type === 'C_COMMAND') {
        let i = 0;
        let j = 0;
        let dest = null;
        let comp = null;
        let jump = null;
        while (true) {
          if (line[i] === ' ' || line[i] === undefined) {
            if (comp) {
              jump = line.substring(j, i);
            } else {
              comp = line.substring(j, i);
            }
            break;
          } else if (line[i] === '=') {
            dest = line.substring(j, i);
            j = i + 1;
          } else if (line[i] === ';') {
            comp = line.substring(j, i);
            j = i + 1;
          }
          i++;
        }
        this.writeStream.write(`${this.toBinary(type, address, dest, comp, jump)}\n`);
      }
    });
    return new Promise(resolve => {
      this.fileReader.on('close', () => {
        this.writeStream.end();
        resolve();
      });
    });
  }

  async assemble() {
    await this.parse();
    await this.compile();
  }

  commandType(line) {
    if (line.length === 0) {
      return null;
    }

    let letter = line[0];
    if (letter === '/') {
      return null;
    } else if (letter === '@') {
      return 'A_COMMAND';
    } else if (letter === '(') {
      return 'L_COMMAND';
    } else {
      return 'C_COMMAND';
    }
  }

  symbol(line, type) {
    let i = 1;
    let letter = line[i];
    let end = type === 'A_COMMAND' ? ' ' : ')';
    while (letter && letter !== end) {
      letter = line[++i];
    }
    return line.substring(1, i);
  }

  toBinary(type, address, dest, comp, jump) {
    const compToBinary = {
      '0': '0101010',
      '1': '0111111',
      '-1': '0111010',
      'D': '0001100',
      'A': '0110000',
      'M': '1110000',
      '!D': '0001101',
      '!A': '0110001',
      '!M': '1110001',
      '-D': '0001111',
      '-A': '0110011',
      '-M': '1110011',
      'D+1': '0011111',
      'A+1': '0110111',
      'M+1': '1110111',
      'D-1': '0001110',
      'A-1': '0110010',
      'M-1': '1110010',
      'D+A': '0000010',
      'D+M': '1000010',
      'D-A': '0010011',
      'D-M': '1010011',
      'A-D': '0000111',
      'M-D': '1000111',
      'D&A': '0000000',
      'D&M': '1000000',
      'D|A': '0010101',
      'D|M': '1010101'
    };
    const destToBinary = {
      'null': '000',
      'M': '001',
      'D': '010',
      'A': '100',
      'AM': '101',
      'AD': '110',
      'MD': '011',
      'AMD': '111'
    };
    const jumpToBinary = {
      'null': '000',
      'JGT': '001',
      'JEQ': '010',
      'JLT': '100',
      'JNE': '101',
      'JLE': '110',
      'JGE': '011',
      'JMP': '111'
    };
    if (type === 'A_COMMAND') {
      return ('0000000000000000' + Number(address).toString(2)).slice(-16);
    } else {
      return '111' + compToBinary[comp] + destToBinary[dest] + jumpToBinary[jump];
    }
  }
}

const parser = new Parser(filePath);
parser.assemble();