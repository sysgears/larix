const fs = require('fs');

const contents = fs.readFileSync('./server-ts.patch', 'utf8');
console.log(contents.match(/^---[^\t]+\t[^\t]+\t(.+)$/m));
