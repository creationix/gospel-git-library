var http = require('http');
var zlib = require('zlib');

module.exports = get;
function get(path, callback) {
  http.get({
    hostname: "broadcast3.lds.org",
    path: path
  }, function (res) {
    var body;
    if (res.headers["content-type"] === "application/x-deflate") {
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
      body = JSON.parse(body);
      callback(null, {
        statusCode: res.statusCode,
        headers: res.headers,
        body: body
      });
    });
  });
}
