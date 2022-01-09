const exports = {};

global.window = { exports };
await import("./src/index.mjs");
delete global.window;

const { AS_IS, deserializer, atomizer, rebuilder, serializeAtoms } = exports;

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

const fancy = atomizer({
  bytes: (bytes, write) => {
    console.log("WRITING", bytes);
    write(bytes, AS_IS);
  },
})([new Uint8Array([1]), new Uint8Array([2, 3])]);
const back = deserializer((next) => next())(serializeAtoms(fancy));
console.log("custom bytes", fancy, back);

run(
  [null, null],
  {
    null: (x, write) => {
      write("a");
      write("b");
      write("c");
      return AS_IS;
    },
  },
  (next) => {
    console.log(next(), next(), next());
    return null;
  }
);

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
