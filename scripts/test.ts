import { NodeFS } from 'breadfs/node';
import { BreadFS } from 'breadfs';

const fs = BreadFS.of(NodeFS);
const abc = fs.path('abc');
const def = fs.path('def');

console.log(abc, def);
