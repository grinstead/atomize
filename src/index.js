import {
  atomizer as atomizer_,
  encodeBoolean,
  encodeNull,
  encodeNumber,
  encodeVoid,
  ALLOW_SELF_REFERENCE,
  encodeArray,
  encodeString,
  encodeMap,
  encodeSet,
  encodeObject,
  AS_IS,
} from "./atomize.mjs";

function unsupported(val, write) {
  throw new Error(`No way to atomize ${val}`);
}

function encodeAsIs(val, write) {
  write(val, AS_IS);
}

function atomizer(builders = {}) {
  const unknown = builders["keepUnknownsAsIs"] ? encodeAsIs : unsupported;
  const cleaned = {
    void: builders["void"] || encodeVoid,
    null: builders["null"] || encodeNull,
    boolean: builders["boolean"] || encodeBoolean,
    number: builders["number"] || encodeNumber,
    Array: builders["Array"] || encodeArray,
    string: builders["string"] || encodeString,
    Map: builders["Map"] || encodeMap,
    Set: builders["Set"] || encodeSet,
    object: builders["object"] || encodeObject,
    function: builders["function"] || unknown,
  };

  return atomizer_(cleaned);
}

window["exports"]["ALLOW_SELF_REFERENCE"] = ALLOW_SELF_REFERENCE;
window["exports"]["encodeVoid"] = encodeVoid;
window["exports"]["encodeNull"] = encodeNull;
window["exports"]["encodeBoolean"] = encodeBoolean;
window["exports"]["encodeNumber"] = encodeNumber;
window["exports"]["encodeArray"] = encodeArray;
window["exports"]["encodeString"] = encodeString;
window["exports"]["encodeMap"] = encodeMap;
window["exports"]["encodeSet"] = encodeSet;
window["exports"]["encodeObject"] = encodeObject;
window["exports"]["AS_IS"] = AS_IS;
window["exports"]["atomizer"] = atomizer;
