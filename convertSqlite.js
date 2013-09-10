var spawn = require('child_process').spawn;
var assert = require('assert');
var convertHtml = require('./convertHtml.js');

// input is the sqlite3 database as a single buffer
module.exports = convert;
function convert(file, callback) {
  var state = $headers;
  var names = ["node", "media", "bookmeta"];
  var name, columns;
  var all = {};
  var query = names.map(function (name) {
    all[name] = [];
    return "SELECT '" + name + "' AS 'table', * FROM " + name + " LIMIT 10;";
  }).join("");
  
  var child = spawn("sqlite3", ["-header", "-csv", file, query]);
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', createParser(onRow));
  child.stdout.on('end', function () {
    callback(null, all);
  });
  function onRow(row) {
    console.log(row);
    state = state(row);
  }

  function $headers(values) {
    name = names.shift();
    assert.equal(values.shift(), "table");
    columns = values;
    return $row;
  }
  
  function $row(values) {
    if (values[0] === "table") return $headers(values);
    name = values.shift();
    var row = {};
    for (var i = 0, l = values.length; i < l; i++) {
      row[columns[i]] = values[i];
    }
    if (name === "node") {
      row.content = row.content ? convertHtml(row.content).slice(1) : null;
      row.refs = row.refs ? convertHtml(row.refs).slice(1) : null;
    }
    all[name].push(row);
    return $row;
  }
  
}


function createParser(onRow) {
  var row = [];
  var entry = "";
  var state = $normal;
  return function (chunk) {
    for (var i = 0, l = chunk.length; i < l; ++i) {
      state = state(chunk[i]); 
    }
  };
  
  function push() {
    if (/^[0-9]+$/.test(entry)) entry = parseInt(entry, 10);
    row.push(entry);
    entry = "";
  }

  function $normal(char) {
    if (char === '"') {
      return $quote;
    }
    if (char === ",") {
      push();
    }
    else if (char === "\n") {
      push();
      onRow(row);
      row = [];
    }
    else {
      entry += char;
    }
    return $normal;
  }
  
  function $quote(char) {
    if (char === '"') {
      return $maybe;
    }
    entry += char;
    return $quote;
  }

  function $maybe(char) {
    if (char === '"') {
      entry += char;
      return $quote;
    }
    return $normal(char);
  }

}
