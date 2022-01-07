import { atomizer } from "./dist/atomize.min.mjs";

const x = [1];
x.push(x);

console.log(atomizer()([x, 0.5]));
