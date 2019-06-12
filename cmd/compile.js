var exec = require('child_process').exec;
var process = require('process');
var path = require('path');
var fs = require('fs');
var os = require('os');

///////////////////////////////////////////////////////////////////////////////////
function FilesCollection() {
  this.files = [];
}

FilesCollection.prototype[Symbol.iterator] = function () {
  let count = 0;
  isDone = false;
  let next = () => {
    if (count >= this.files.length) {
      isDone = true;
    }
    return { done: isDone, value: this.files[count++] };
  }
  return { next };
};

FilesCollection.prototype.count = function () {
  return this.files.length;
};

FilesCollection.prototype.indexOf = function (file) {
  const filepath = path.resolve(file);
  let i = 0;
  while (i < this.files.length) {
    if (this.files[i].path == filepath) return i;
    i++;
  }
  return -1;
};

FilesCollection.prototype.contains = function (file) {
  return this.indexOf(file) != -1;
};

FilesCollection.prototype.addFile = function (file) {
  const filepath = path.resolve(file);
  const dirname = path.dirname(filepath);
  const filename = path.basename(filepath);
  const extension = path.extname(filepath);
  const fo = {
    path: filepath,
    dirname: dirname,
    filename: filename,
    exists: fs.existsSync(filepath),
    isSource: ['.pas', '.pp'].includes(extension)
  };
  if (!this.contains(file)) {
    this.files.push(fo);
  }
};

FilesCollection.prototype.removeFile = function (file) {
  let idx = this.indexOf(file);
  if (idx != -1) {
    this.files.splice(idx, 1);
  }
};

FilesCollection.prototype.addFiles = function (...files) {
  for (let file of files) {
    this.addFile(file);
  }
}
//////////////////////////////////////////////////////////////////////////////////////////
function CompilerOutput(file) {
  this.file = file;
  this.errors = [];
  this.has_errors = false;
}

CompilerOutput.prototype.hasErrors = function () {
  return this.has_errors;
};

CompilerOutput.prototype.setOutput = function (out) {
  const outl = out.split(os.EOL);
  this.errors = [];
  this.has_errors = false;
  for (let line of outl) {
    if (line == '') continue;
    const err = this.parseLine(line);
    if (err.type == 'error') this.has_errors = true;
    this.errors.push(err);
  }
};

CompilerOutput.prototype.parseLine = function (line) {
  // Error type --> pp03.pas(3,7) Error: Identifier not found "i"
  let regex = /^(\w+\.\w+)\s*\((\d+),(\d+)\)\s*(\w+)\:\s*(.+)$/gm;
  let m;

  if ((m = regex.exec(line)) !== null) {
    // This is necessary to avoid infinite loops with zero-width matches
    if (m.index === regex.lastIndex) {
      regex.lastIndex++;
    }
    const errObj = {
      filename: m[1],
      line: parseInt(m[2]),
      column: parseInt(m[3]),
      level: m[4],
      type: 'error',
      message: m[5]
    };
    return errObj;
  }

  // Error type --> Fatal: Compilation aborted
  regex = /^(\w+)\:\s*(.+)$/gm;
  if ((m = regex.exec(line)) !== null) {
    // This is necessary to avoid infinite loops with zero-width matches
    if (m.index === regex.lastIndex) {
      regex.lastIndex++;
    }
    const errObj = {
      type: 'error',
      level: m[1],
      message: m[2]
    };
    return errObj;
  }

  // operation to file -->
  // Compiling pp02.pas
  // Linking pp02.exe
  regex = /^(\w+)\s*(\w+\.\w+)$/gm;
  if ((m = regex.exec(line)) !== null) {
    // This is necessary to avoid infinite loops with zero-width matches
    if (m.index === regex.lastIndex) {
      regex.lastIndex++;
    }
    const errObj = {
      type: 'operation',
      operation: m[1],
      file: m[2],
      message: line
    };
    return errObj;
  }

  return {
    type: 'information',
    message: line
  };
};

/**
 * levels is an array of the levels of errors
 */
CompilerOutput.prototype.filter = function (levels) {
  return this.errors.filter(error => levels.includes(error.type));
};

//////////////////////////////////////////////////////////////////////////////////////////

function Compiler(path, fileCompiledCallback) {
  this.path = path;
  this.files = new FilesCollection();
  this.fileCompiledCallback = fileCompiledCallback || function () { };
  this.allFilesCompiledCallback = fileCompiledCallback || function () { };
  this.outputs = {};
}

Compiler.prototype.compile = function () {
  this.files_count = 0;
  for (let file of this.files) {
    this.compileFile(file);
  }
};

Compiler.prototype.compiled = function (file) {
  this.files_count++;
  this.fileCompiledCallback(file, this.files_count, this.files.count());

  if (this.files_count == this.files.count()) {
    this.fileCompiledCallback();
  }
};

Compiler.prototype.compileFile = function (file) {
  const thisObj = this;
  const cwd = process.cwd();
  const cmd = `"${this.path}" "${file.filename}"`;

  process.chdir(file.dirname);

  exec(cmd, function (error, stdout, stderr) {
    // console.log('Errors: ', stderr);
    // console.log('Output: ', stdout);
    if (!thisObj.outputs[file.path]) {
      thisObj.outputs[file.path] = new CompilerOutput(file.filename);
    }
    thisObj.outputs[file.path].setOutput(stdout);
    // console.log('Command errors: ', error);
    process.chdir(cwd);

    thisObj.compiled(file);
  })
};

// Tests
compiler = new Compiler("D:\\Lazarus\\fpc\\3.0.4\\bin\\x86_64-win64\\fpc.exe", function (file, cp, cnt) {
  if (file) {
    console.log('Compiled', cp, 'out of', cnt);
  } else {
    console.log('All files compiled!');
  }
});

compiler.files.addFile('.\\pp01.pas');
compiler.files.addFile('.\\pp02.pas');
compiler.files.addFile('.\\pp03.pas');
compiler.files.addFile('.\\pp04.pas');
compiler.files.addFile('.\\pp05.pas');

//compiler.compile(".\\pp01.pas");
//compiler.compile("pp02.pas");
//compiler.compile(".\\pp03.pas");
compiler.compile(() => {
  console.log(compiler.outputs);
});

/*
compiler.files.addFile('.\\pp01.pas');
compiler.files.addFile("pp02.pas");
compiler.files.addFile(".\\pp03.pas");
compiler.files.addFile('.\\pp0x.pas');

compiler.files.addFiles('.\\pp04.pas', '.\\pp05.pas');

console.log(compiler.files);
*/