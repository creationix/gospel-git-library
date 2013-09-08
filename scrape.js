var get = require('./get.js');

var catalogUrl, modifiedUrl, languagesUrl;

function getCatalog(language, callback) {
  get("/crowdsource/Mobile/glweb2/config/gospellibrary/android/config.240.json", function (err, config) {
    if (err) return callback(err);
    if (typeof language === "string") {
      var languagesQuery = config.body["languages.query"];
      return get(languagesQuery, function (err, langs) {
        if (err) return callback(err);
        langs = langs.body.languages;
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
      var catalogQuery = config.body["catalog.query"].replace("@language", language).replace("@platform", 4);
      get(catalogQuery, function (err, catalog) {
        if (err) return callback(err);
        callback(null, catalog.body);
      });
    }
  });
}  

getCatalog("en", function (err, catalog) {
  if (err) throw err;
  console.log(catalog);
});
