var exec = require('child_process').exec;
var child_process = require('child_process');
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
    extension: extension,
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
  this.outcome_ext = '';
  this.linking_ok = false;
  for (let line of outl) {
    if (line == '') continue;
    const err = this.parseLine(line);
    if (err.type == 'error') {
      if (err.subtype == 'compile' && err.message == "Compilation aborted") {
        this.linking_ok = false;
        this.outcome_ext = '';
      }
      this.has_errors = true;
    }
    if (err.type == 'operation' && err.operation == 'Linking') {
      this.outcome_ext = '.exe';
      this.linking_ok = true;
    }
    this.errors.push(err);
  }
  if (!this.hasErrors() && this.outcome_ext == '') {
    this.outcome_ext = '.ppu';
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
      subtype: 'file',
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
      subtype: 'compile',
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
  this.outputs = {};
}

Compiler.prototype.compile = function () {
  this.files_count = 0;
  for (let file of this.files) {
    this.compileFile(file);
  }
};

Compiler.prototype.compiled = function (file) {
  if (this.outputs[file.path].outcome_ext == '') {
    file.comp_result = null;
  } else if (this.outputs[file.path].outcome_ext != '') {
    file.comp_result = file.path.substr(0, file.path.length - file.extension.length) + this.outputs[file.path].outcome_ext;
    console.log(file.comp_result);
    if (!fs.existsSync(file.comp_result)) {
      file.comp_result = null;
    }
  }
  console.log('Generated', file.comp_result);
  this.files_count++;
  this.fileCompiledCallback(this, file, this.files_count, this.files.count());

  if (this.files_count == this.files.count()) {
    this.fileCompiledCallback(this);
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

//////////////////////////////////////////////////////////////////////////////////////////

function ProgramLauncher(filepath) {
  if (!filepath.endsWith(".exe")) {
    throw new Error("Cannot launch process of this type!");
  }
  this.filepath = filepath;
  this.inputfile = null;
  this.proc = null;
}

ProgramLauncher.prototype.setInputFile = function(inputfile) {
  this.inputfile = inputfile;
};

ProgramLauncher.prototype.launch = function() {
  if (!fs.existsSync(this.filepath)) {
    throw new Error(`File not found "${this.filepath}"`);
  }
  if (!this.isLaunched()) {
    this.proc = child_process.spawn(this.filepath, (this.inputfile) ? [`<"${this.inputfile}"`] : [], {
      detached: true,
      shell: true
    });
    this.proc.on('close', () => {
      this.proc = null;
    });
  } else {
    throw new Error("Process is already launched, kill before relaunching.");
  }
};

ProgramLauncher.prototype.isLaunched = function() {
  return (this.proc && !this.proc.killed);
};

ProgramLauncher.prototype.kill = function() {
  if (this.isLaunched()) {
    this.proc.kill();
  }
};

let FPC = "C:\\lazarus\\fpc\\3.0.4\\bin\\i386-win32\\fpc.exe";
// let FPC = "D:\\Lazarus\\fpc\\3.0.4\\bin\\x86_64-win64\\fpc.exe";

// Tests
compiler = new Compiler(FPC, function (compiler, file, cp, cnt) {
  if (file) {
    console.log('Compiled', cp, 'out of', cnt, ':', file.path);
    if (compiler.outputs[file.path].hasErrors()) {
      console.log('Has errors!');
    } else {
      console.log(compiler.outputs[file.path].outcome_ext);
      if (file.comp_result && file.comp_result.endsWith('.exe')) {
        pl = new ProgramLauncher(file.comp_result);
        try {
          pl.launch();
        }
        catch (e) {
          console.log(e);
        }
      }
    }
  } else {
    console.log('All files compiled!');
  }
});

compiler.files.addFile('.\\pp01.pas');
compiler.files.addFile('.\\pp02.pas');
compiler.files.addFile('.\\pp03.pas');
compiler.files.addFile('.\\pp04.pas');
compiler.files.addFile('.\\pp05.pas');

compiler.compile();
