import { atomizer } from "./dist/atomize.min.mjs";
import { rebuilder } from "./src/atomize.mjs";

const x = [1];
x.push(x);

const y = new Map();
y.set(1, "hi");
y.set("hi", 4);
y.set(x, new Set([y, "boom"]));

const run = (x, encode, decode) => {
  const atomized = atomizer(encode)(x);
  console.log(atomized);
  console.log(rebuilder(decode)(atomized));
};

run({ a: y, b: 2 });

console.log(atomizer({ keepUnknownsAsIs: true })(new RegExp("hi")));
