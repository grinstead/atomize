import {
  atomizer as atomizer_,
  encodeBoolean,
  encodeNull,
  encodeVoid,
} from "./atomize.mjs";

function atomizer(builders = {}) {
  const cleaned = {
    void: builders["void"] || encodeVoid,
    null: builders["null"] || encodeNull,
    boolean: builders["boolean"] || encodeBoolean,
  };

  return atomizer_(cleaned);
}

window["exports"]["atomizer"] = atomizer;
window["exports"]["encodeVoid"] = encodeVoid;
window["exports"]["encodeNull"] = encodeNull;
window["exports"]["encodeBoolean"] = encodeBoolean;

// && sed -i '' 's/\bwindow\\.//g' dist/atomize.min.js
