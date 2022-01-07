import {
  atomizer as atomizer_,
  encodeBoolean,
  encodeNull,
  encodeNumber,
  encodeVoid,
  encodeArray,
  encodeString,
  encodeMap,
  encodeSet,
  encodeObject,
  AS_IS,
  customEncoder,
  rebuilder,
  serialize,
  deserializer,
} from "./atomize.mjs";

function unsupported(val, write) {
  throw new Error(`No way to atomize ${String(val)}`);
}

function encodeAsIs(val, write) {
  write(val, AS_IS);
  return true;
}

function atomizer(builders = {}) {
  const unknown = builders["keepUnknownsAsIs"] ? encodeAsIs : unsupported;
  const cleaned = {
    void: customEncoder(builders["void"], encodeVoid),
    null: customEncoder(builders["null"], encodeNull),
    boolean: customEncoder(builders["boolean"], encodeBoolean),
    number: customEncoder(builders["number"], encodeNumber),
    Array: customEncoder(builders["Array"], encodeArray),
    string: customEncoder(builders["string"], encodeString),
    Map: customEncoder(builders["Map"], encodeMap),
    Set: customEncoder(builders["Set"], encodeSet),
    object: customEncoder(builders["object"], encodeObject),
    function: customEncoder(builders["function"], unknown),
    symbol: customEncoder(builders["symbol"], unknown),
    instance: customEncoder(builders["instance"], unknown),
  };

  return atomizer_(cleaned);
}

window["exports"]["AS_IS"] = AS_IS;
window["exports"]["atomizer"] = atomizer;
window["exports"]["rebuilder"] = rebuilder;
window["exports"]["serialize"] = serialize;
window["exports"]["deserializer"] = deserializer;
