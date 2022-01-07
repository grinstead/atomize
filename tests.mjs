import { atomizer } from "./dist/atomize.min.mjs";

const x = [1];
x.push(x);

const y = new Map();
y.set(1, "hi");
y.set("hi", 4);
y.set(x, new Set([y, "boom"]));

console.log(atomizer()({ a: y, b: 2 }));
