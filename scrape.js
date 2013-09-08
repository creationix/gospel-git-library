var get = require('./get.js');
var urlParse = require('url').parse;

var catalogUrl, modifiedUrl, languagesUrl;

function getCatalog(language, callback) {
  get("/crowdsource/Mobile/glweb2/config/gospellibrary/android/config.240.json", function (err, config) {
    if (err) return callback(err);
    if (/^[0-9]+$/.test(language)) language = parseInt(language, 10);
    if (typeof language === "string") {
      var languagesQuery = config["languages.query"];
      return get(languagesQuery, function (err, langs) {
        if (err) return callback(err);
        langs = langs.languages;
        for (var i = 0, l = langs.length; i < l; ++i) {
          var lang = langs[i];
          if (language === lang.code ||
              language === lang.code_three ||
              language === lang.name ||
              language === lang.end_name) {
            language = lang.id;
            return load();
          }
        }
        console.log("Warning: Unknown language " + language);
        language = 1;
        load();
      });
    }
    load();
    function load() {
      var catalogQuery = config["catalog.query"].replace("@language", language).replace("@platform", 4);
      get(catalogQuery, function (err, catalog) {
        if (err) return callback(err);
        callback(null, catalog.catalog);
      });
    }
  });
}

var inspect = require('util').inspect;
function log(obj) {
  console.log(inspect(obj, {colors: true}));
}

var books = {};

// getCatalog("en", function (err, catalog) {
//   if (err) throw err;
//   dump(catalog);
//   var keys = Object.keys(books);
//   keys.sort();
//   log(keys);
//   var book = books["/youth/learn/ap"];
//   decompress(book, function (err, db) {
//     if (err) throw err;
//     log(book);
//     log(db);
//     db.get("SELECT * FROM bookmeta;", function (err, result) {
//       if (err) throw err;
//       log(result);
//       var nodes = {};
//       var prefixLength = book.gl_uri.length;
//       db.each("SELECT * FROM node;", function (err, row) {
//         if (err) throw err;
//         var path = row.uri.substr(prefixLength);
//         nodes[path] = row;
//       }, function () {
//         var keys = Object.keys(nodes);
//         keys.sort();
//         log(keys);
//         log(nodes["/commandments/say"]);
//       });
//     });
//   });
// });

require('js-git/lib/platform.js')(require('js-git-node-platform'));
var msgpack = require('msgpack-js');
var dirname = require('path').dirname;
var basename = require('path').basename;
var fsDb = require('js-git/lib/fs-db.js');
var wrap = require('js-git/lib/repo.js');
var fs = require('fs');


getCatalog(process.argv[2], function (err, catalog) {
  if (err) throw err;
  dump(catalog);
  Object.keys(books).forEach(function (uri) {
//    if (!(/^\/youth\/learn\/ap/).test(uri)) return;
    var book = books[uri];
    decompress(book, function (err, db) {
      if (err) throw err;
      var path = uri.substr(1) + ".git";
      mkdirp(dirname(path), function (err) {
        if (err) throw err;
        var repo = wrap(fsDb(path, true));
        repo.init(function (err) {
          if (err) throw err;
          convert(book, db, repo);
        });
      });
    });
  });
});

var author = "Tim Caswell <tim@creationix.com>";
var committer = "JS-Git <js-git@creationix.com>";

function convert(book, db, repo) {
  console.log(book.gl_uri);
  var files = {};
  files["META.msgpack"] = msgpack.encode(book);
  var prefixLength = book.gl_uri.length;
  db.each("SELECT * FROM node;", function (err, row) {
    if (err) throw err;
    console.log(row.uri);
    var path = row.uri.substr(prefixLength);
    // console.log(path);
    var dir = dirname(path).substr(1);
    var obj = files;
    dir.split("/").forEach(function (seg) {
      if (!seg) return;
      var dir = obj[seg];
      if (!dir) dir = obj[seg] = {};
      obj = dir;
    });
    obj[basename(path) + ".msgpack"] = msgpack.encode(row);
  }, function () {
    db.close();
    saveTree(repo, files, function (err, hash) {
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
    });
  });
}

function gitDate(date) {
  var timezone = date.getTimezoneOffset() / 60;
  var seconds = Math.floor(date.getTime() / 1000);
  return seconds + " " + (timezone > 0 ? "-0" : "0") + timezone + "00";
}

function saveTree(repo, tree, callback) {
  var keys = Object.keys(tree);
  var entries = {};
  shift();
  function shift() {
    var name = keys.shift();
    if (!name) {
      return repo.saveTree(entries, callback);
    }
    var node = tree[name];
    var mode;
    if (Buffer.isBuffer(node)) {
      mode = 0100644;
      return repo.saveBlob(node, onSave);
    }
    mode = 040000;
    saveTree(repo, node, onSave);
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

function mkdirp(path, callback) {
  make();
  function make(err) {
    if (err) return callback(err);
    fs.mkdir(path, onmkdir);
  }
  function onmkdir(err) {
    if (err) {
      if (err.code === "ENOENT") return mkdirp(dirname(path), make);
      if (err.code === "EEXIST") return callback();
      return callback(err);
    }
    callback();
  }
}



function dump(cat) {
  cat.books.forEach(function (book) {
    books[book.gl_uri] = book;
  });
  cat.folders.forEach(dump);
}

var sqlite3 = require('sqlite3');
var fs = require('fs');

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
