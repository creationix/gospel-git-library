var gumbo = require("gumbo-parser");

module.exports = convert;
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
