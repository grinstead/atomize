import {
  atomizer as atomizer_,
  encodeBoolean,
  encodeNull,
  encodeNumber,
  encodeVoid,
  ALLOW_SELF_REFERENCE,
} from "./atomize.mjs";

function atomizer(builders = {}) {
  const cleaned = {
    void: builders["void"] || encodeVoid,
    null: builders["null"] || encodeNull,
    boolean: builders["boolean"] || encodeBoolean,
    number: builders["number"] || encodeNumber,
  };

  return atomizer_(cleaned);
}

window["exports"]["ALLOW_SELF_REFERENCE"] = ALLOW_SELF_REFERENCE;
window["exports"]["encodeVoid"] = encodeVoid;
window["exports"]["encodeNull"] = encodeNull;
window["exports"]["encodeBoolean"] = encodeBoolean;
window["exports"]["encodeNumber"] = encodeNumber;
window["exports"]["atomizer"] = atomizer;
