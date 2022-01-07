import { atomizer } from "./dist/atomize.min.mjs";

const x = [1];
x.push(x);

console.log(atomizer()([x, "hello", 0.5]));
