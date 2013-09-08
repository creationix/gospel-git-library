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
