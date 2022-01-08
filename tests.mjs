import { atomizer, rebuilder, serializeAtoms } from "./dist/atomize.min.mjs";
import { deserializer } from "./src/atomize.mjs";

const run = (x, encode, decode) => {
  console.log("\n// test");
  const atomized = atomizer(encode)(x);
  console.log(atomized);

  const serialized = serializeAtoms(atomized);
  console.log(serializeAtoms(atomized));

  console.log(deserializer(decode)(serialized));
  // console.log(rebuilder(decode)(atomized));
};

const x = [1];
x.push(x);

const y = new Map();
y.set(1, "hi");
y.set("hi", 4);
y.set(x, new Set([y, "boom"]));

const a = [];
a.push(a);

run(-1);

// run(new DataView(new Uint8Array([1, 2, 3]).buffer));
run(new DataView(new Uint8Array([1, 2, 3]).buffer));

run([["a", "a2"], "b"]);

run(
  ["hi", a],
  {
    string(str, write) {
      write(str === "hi" ? true : false);
    },
  },
  (next) => {
    return next() === true ? "hi" : "baloney";
  }
);

const oof = { test: 1 };
oof.test = oof;
run({ a: y, b: 2, x: oof });
