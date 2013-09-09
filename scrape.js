var get = require('./get.js');
var urlParse = require('url').parse;
var inspect = require('util').inspect;
var msgpack = require('msgpack-js');
var dirname = require('path').dirname;
var basename = require('path').basename;
var fs = require('fs');
var sqlite3 = require('sqlite3');
require('js-git/lib/platform.js')(require('js-git-node-platform'));
var fsDb = require('js-git/lib/fs-db.js');
var wrap = require('js-git/lib/repo.js');

// Nested objects representing all the files in directory structure
var files = {};
// path to dir hash mapping for books
var branches = {};
// tells which paths are book paths
var isBook = {};
var author = "Tim Caswell <tim@creationix.com>";
var committer = "JS-Git <js-git@creationix.com>";

var pending = 0;
var repo = wrap(fsDb('gospel-library.git', true));
repo.init(function (err) {
  if (err) throw err;
  get.catalog(process.argv[2], function (err, catalog) {
    if (err) throw err;
    dump(catalog);
  });
});

function dump(catalog) {
  pending++;
  catalog.books.forEach(saveBook);
  catalog.folders.forEach(dump);
  check();
}

function saveBook(book) {
  var uri = book.gl_uri;
  isBook[uri] = true;
  // if (!(/^\/youth\/learn/).test(uri)) return;
  console.log(uri);
  pending++;
  decompress(book, function (err, db) {
    if (err) throw err;
    saveBlob(book, uri + "/.book");
    db.each("SELECT * FROM node;", function (err, row) {
      if (err) throw err;
      saveBlob(row, row.uri);
    }, function () {
      db.close();
      fs.unlink(db.filename);
      check();
    });
  });
}

function decompress(book, callback) {
  var path = urlParse(book.url).path;
  get(path, function (err, sqlite) {
    if (err) throw err;
    var file = book.file.replace(/\.zbook$/, ".sqlite3");
    fs.writeFile(file, sqlite, function (err) {
      if (err) return callback(err);
      var db = new sqlite3.Database(file, function (err) {
        if (err) return callback(err);
        callback(null, db);
      });
    });
  });
}

function saveBlob(obj, path) {
  pending++;
  var buf = msgpack.encode(obj);
  repo.saveBlob(buf, function (err, hash) {
    if (err) throw err;
    var obj = files;
    var dir = "";
    dirname(path).split("/").forEach(function (part) {
      if (!part) return;
      dir += "/" + part;
      var tmp = obj[part];
      if (!tmp) {
        tmp = obj[part] = {};
        if (isBook[dir]) {
          tmp.$book = dir;
        }
      }
      obj = tmp;
    });
    obj[basename(path) + ".msgpack"] = hash;
    check();
  });
}

function check() {
  if (--pending) return;
  saveTree(files, onSaveAll);
}

function onSaveAll(err, hash) {
  if (err) throw err;
  var now = gitDate(new Date());
  var commit = {
    tree: hash,
    author: author + " " + now,
    committer: committer + " " + now,
    message: "Initial Commit.\nImported from Sqlite3"
  };
  repo.saveCommit(commit, function (err, hash) {
    if (err) throw err;
    repo.updateHead(hash, function (err) {
      if (err) throw err;
    });
  });
  Object.keys(branches).forEach(function (ref) {
    var commit = {
      tree: branches[ref],
      author: author + " " + now,
      committer: committer + " " + now,
      message: "Saving book as branch " + ref.substr(10)
    };
    repo.saveCommit(commit, function (err, hash) {
      if (err) throw err;
      repo.writeRaw(ref, hash + "\n", function (err) {
        if (err) throw err;
      });
    });
  });
}

function gitDate(date) {
  var timezone = date.getTimezoneOffset() / 60;
  var seconds = Math.floor(date.getTime() / 1000);
  return seconds + " " + (timezone > 0 ? "-0" : "0") + timezone + "00";
}

function saveTree(tree, callback) {
  var keys = Object.keys(tree);
  var entries = {};
  var branch;
  shift();
  function shift() {
    var name = keys.shift();
    if (!name) {
      return repo.saveTree(entries, function (err, hash) {
        if (err) return callback(err);
        if (branch) {
          branches["refs/heads" + branch] = hash;
        }
        callback(null, hash);
      });
    }
    var node = tree[name];
    var mode;
    if (name === "$book") {
      branch = node;
      return shift();
    }
    if (typeof node === "string") {
      mode = 0100644;
      return onSave(null, node);
    }
    mode = 040000;
    saveTree(node, onSave);
    function onSave(err, hash) {
      if (err) return callback(err);
      entries[name] = {
        mode: mode,
        hash: hash
      };
      shift();
    }
  }
}

function log(obj) {
  console.log(inspect(obj, {colors: true, depth: null}));
}
