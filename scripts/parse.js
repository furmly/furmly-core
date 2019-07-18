#!/usr/bin/env node

var stdin = process.openStdin();
String.prototype.toCamelCase = function() {
  return this.replace(/\s(.)/g, function($1) {
    return $1.toUpperCase();
  })
    .replace(/\s/g, "")
    .replace(/^(.)/, function($1) {
      return $1.toLowerCase();
    });
};
var data = "";
const define = "!define";
const modules = "!modules";
const name = "!name";
stdin.on("data", function(chunk) {
  data += chunk;
});
function getModuleName(name) {
  const right = name
    .split("`")[0]
    .replace("-", " ")
    .toCamelCase();
  return name[0].toUpperCase() + right.substring(1);
}
stdin.on("end", function() {
  const def = JSON.parse(data);
  const parsedModules = def[define][modules];
  const newDefine = {};
  for (let prop in parsedModules) {
    if (prop == def[name]) continue;
    let moduleName = getModuleName(prop);
    data = data.replace(new RegExp(`${modules}.${prop}`, "igm"), moduleName);
    newDefine[moduleName] = JSON.parse(data)[define][modules][prop];
  }
  const newDef = { ...JSON.parse(data), [define]: newDefine, [name]: "furmly" };

  console.log(JSON.stringify(newDef, null, " "));
});
