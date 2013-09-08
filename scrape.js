var get = require('./get.js');
var urlParse = require('url').parse;

var catalogUrl, modifiedUrl, languagesUrl;

function getCatalog(language, callback) {
  get("/crowdsource/Mobile/glweb2/config/gospellibrary/android/config.240.json", function (err, config) {
    if (err) return callback(err);
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

var books = {};

getCatalog("en", function (err, catalog) {
  if (err) throw err;
  dump(catalog);
  var keys = Object.keys(books);
  keys.sort();
  var book = books[keys[0]];
  decompress(book, function (err, db) {
    if (err) throw err;
    console.log(book);
    console.log(db);
  });
});

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
    var file = book.file.replace(/\.zbook$/, ".sqlite");
    fs.writeFile(file, sqlite, function (err) {
      if (err) return callback(err);
      var db = new sqlite3.Database(file, function (err) {
        if (err) return callback(err);
        callback(null, db);
      });
    });
  });
}