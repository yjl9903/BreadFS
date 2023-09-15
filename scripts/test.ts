import { BreadFS, NodeFS } from 'breadfs/node';

const fs = BreadFS.of(NodeFS);
const abc = fs.path('abc');
const def = fs.path('def');

console.log(abc, def);
