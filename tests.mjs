import { atomizer } from "./dist/atomize.min.mjs";
import { rebuilder } from "./src/atomize.mjs";

const run = (x, encode, decode) => {
  console.log("\n// test");
  console.log(x);
  const atomized = atomizer(encode)(x);
  console.log(atomized);
  console.log(rebuilder(decode)(atomized));
};

const x = [1];
x.push(x);

const y = new Map();
y.set(1, "hi");
y.set("hi", 4);
y.set(x, new Set([y, "boom"]));

const a = [];
a.push(a);

run([["a", "a2"], "b"]);

run(
  ["hi", a],
  {
    string(str, write) {
      write(str === "hi" ? true : false);
    },
  },
  (next) => {
    return next() ? "hi" : "baloney";
  }
);

const oof = { test: 1 };
oof.test = oof;
run({ a: y, b: 2, x: oof });
