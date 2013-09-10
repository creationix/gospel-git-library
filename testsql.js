
var convertSqlite = require('./convertSqlite.js');

var file = "Book.of.Mormon.42.sqlite3";
convertSqlite(file, function (err, tables) {
  if (err) throw err;
  require('fs').writeFile("test.json", JSON.stringify(tables));
  console.log(tables);
});


