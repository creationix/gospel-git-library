var get = require('./get.js');
var urlParse = require('url').parse;
var inspect = require('util').inspect;
var dirname = require('path').dirname;
var basename = require('path').basename;
var fs = require('fs');
require('js-git/lib/platform.js')(require('js-git-node-platform'));
var fsDb = require('js-git/lib/fs-db.js');
var wrap = require('js-git/lib/repo.js');
var convertSqlite = require('./convertSqlite.js');

var bookQueue = [];
// Nested objects representing all the files in directory structure
var files = {};
// path to dir hash mapping for books
var branches = {};
// tells which paths are book paths
var isBook = {};
var author = "Tim Caswell <tim@creationix.com>";
var committer = "JS-Git <js-git@creationix.com>";
var numBooks;

var pending = 0;
var repo = wrap(fsDb('gospel-library.git', true));
repo.init(function (err) {
  if (err) throw err;
  get.catalog(process.argv[2], function (err, catalog) {
    if (err) throw err;
    dump(catalog);
    numBooks = bookQueue.length;
    consume();
  });
});

function dump(catalog) {
  catalog.books.forEach(saveBook);
  catalog.folders.forEach(dump);
}

function saveBook(book) {
  if (!(/^(?:\/scriptures|\/youth|\/manual|\/family|\/general-conference\/201|\/young-men|\/ensign\/2013|\/friend\/2013|\/liahona\/2013|\/new-era\/2013|\/video)/).test(book.gl_uri)) return;
  bookQueue.push(book);
}

function consume() {
  var book = bookQueue.shift();
  if (!book) return saveTree(files, onSaveAll);
  var uri = book.gl_uri;
  isBook[uri] = true;
  var clear = "\r\033[K";
  console.log("%s (%s/%s)", uri, numBooks - bookQueue.length, numBooks);
  // TODO: save book somewhere - saveBlob(book, uri + "/.book");
  var file = book.file.replace(/\.zbook$/, ".sqlite3");
  var numNodes, nodes, media, bookmeta;
  process.stdout.write("Downloading sqlite from church database");
  get(urlParse(book.url).path, onSqlite);

  function onSqlite(err, sqlite) {
    if (err) throw err;
    process.stdout.write(clear + "Saving sqlite data to disk.");
    fs.writeFile(file, sqlite, onWriteSqlite);
  }

  function onWriteSqlite(err) {
    if (err) throw err;
    process.stdout.write(clear + "Extracting data from sqlite.");
    convertSqlite(file, onConvertSqlite);
  }

  function onConvertSqlite(err, db) {
    if (err) throw err;
    nodes = db.node;
    media = db.media; // TODO: save this somewhere?
    bookmeta = db.bookmeta[0]; // TODO: save this somewhere?
    process.stdout.write(clear + "Deleting temporary sqlite file.");
    fs.unlink(file, onUnlink);
  }

  function onUnlink(err) {
    if (err) throw err;
    numNodes = nodes.length;
    nextNode();
  }

  function nextNode(err) {
    if (err) throw err;
    var node = nodes.shift();
    if (!node) {
      process.stdout.write(clear);
      return consume();
    }
    var num = numNodes - nodes.length;
    process.stdout.write(clear + "Saving node " + num + "/" + numNodes);
    saveBlob(node.uri + ".node", node, nextNode);
  }

}

function saveBlob(path, value, callback) {
  var blob = new Buffer(JSON.stringify(value) + "\n");
  repo.saveBlob(blob, function (err, hash) {
    if (err) return callback(err);
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
    obj[basename(path) + ".json"] = hash;
    callback();
  });
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
