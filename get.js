var http = require('http');
var zlib = require('zlib');

module.exports = get;
function get(path, callback) {
  http.get({
    hostname: "broadcast3.lds.org",
    path: path
  }, function (res) {
    var body;
    var inflate = false;
    if ((/\.zlib$/).test(path)) {
      inflate = true;
      path = path.substr(0, path.length - 5);
    }
    else if ((/\.zbook/).test(path)) {
      inflate = true;
    }
    if (inflate) {
      body = zlib.createInflate();
      res.pipe(body);
    }
    else {
      body = res;
    }
    var parts = [];
    var length = 0;
    body.on("data", function (chunk) {
      parts.push(chunk);
      length += chunk.length;
    });
    body.on("end", function () {
      var body = Buffer.concat(parts, length);
      if ((/\.json$/).test(path)) {
        body = JSON.parse(body);
      }
      callback(null, body);
    });
  });
}

get.catalog = getCatalog;
function getCatalog(language, callback) {
  if (!language) language = "en";
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
