var spawn = require('child_process').spawn;
var gumbo = require("gumbo-parser");
var fs = require('fs');

var file = "Book.of.Mormon.42.sqlite3";
fs.readFile(file, function (err, data) {
  if (err) throw err;
  convert(data, function (err, tables) {
    if (err) throw err;
    console.log(tables);
  });
});

// input is the sqlite3 database as a single buffer
function convert(input, callback) {
  var query = "SELECT 'node' AS 'table', * FROM node;" +
              "SELECT 'media' AS 'table', * FROM media;" +
              "SELECT 'bookmeta' AS 'table', * FROM bookmeta;";
  var child = spawn("sqlite3", ["-header", "-csv", "/dev/stdin", query]);
  var parser = createParser(onRow);
  child.stdin.end(input);
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', function (chunk) {
    parser.write(chunk);
  });
  function onRow(row) {
    console.log(row);
    // row.content = row.content ? convert(row.content).slice(1) : null;
    // row.refs = row.refs ? convert(row.refs).slice(1) : null;
  }
}


function createParser(onRow) {
  var row = [];
  var entry = "";
  
}
function parseCsv(output) {
  var rows = [];
  var names;
  var row = [];
  var start = 0;
  var skips = [];
  var state = $normal;
  for (var i = 0, l = output.length; i < l; ++i) {
    state = state(output[i]);
  }
  return rows;
  
  function consume(end) {
    var line = "";
    for (var i = 0, l = skips.length; i < l; ++i) {
      var skip = skips[i];
      line += output.substr(start, skip - start);
      start = skip + 1;
    }
    skips.length = 0;
    line += output.substr(start, end - start);
    start = end + 1;
    if (/^[0-9]+$/.test(line)) line = parseInt(line, 10);
    row.push(line);
  }

  function $normal(char) {
    if (char === '"') {
      skips.push(i);
      return $quote;
    }
    if (char === ",") {
      consume(i);
    }
    else if (char === "\n") {
      consume(i);
      if (!names) names = row;
      else rows.push(map(row, names));
      row = [];
    }
    return $normal;
  }
  
  function $quote(char) {
    if (char === '"') {
      skips.push(i);
      return $maybe;
    }
    return $quote;
  }

  function $maybe(char) {
    if (char === '"') return $quote;
    return $normal(char);
  }

}

function map(row, names) {
  var obj = {};
  for (var i = 0, l = row.length; i < l; ++i) {
    obj[names[i]] = row[i];
  }
  return obj;
}

function convert(html) {
  return convertNode(gumbo(html).root.childNodes[1]);
}

function convertNode(node) {
  if (node.nodeType === 3) {
    return node.textContent.trim();
  }
  // Ignore comment nodes
  if (node.nodeType === 8) return;
  if (node.nodeType !== 1) {
    return "TODO: Implement type " + node.nodeType;
  }
  var name = node.tagName === "div" ? "" : node.tagName;
  var attrs;
  node.attributes.forEach(function (attr) {
    if (attr.name === "class") {
      name += "." + attr.value;
      return;
    }
    if (!attrs) attrs = {};
    attrs[attr.name] = attr.value;
  });
  name = name || "div";
  var block = [name];
  if (attrs) block.push(attrs);
  node.childNodes.forEach(function (child) {
    var enc = convertNode(child);
    if (enc) block.push(enc);
  });
  return block;
}
