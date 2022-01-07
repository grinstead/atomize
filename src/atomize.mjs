/**
 * @typedef {function(*,*):void} Writer
 */
let Writer;

/**
 * The type for all the builders that are availabe to the atomizer
 * @typedef {{
 *  void: function(void,Writer):?boolean,
 *  null: function(null,Writer):?boolean,
 *  boolean: function(boolean,Writer):?boolean,
 *  number: function(number,Writer):?boolean,
 *  Array: function(Array<*>,Writer):?boolean,
 *  string: function(string,Writer):?boolean,
 *  Map: function(Map<*,*>,Writer):?boolean,
 *  Set: function(Set<*>,Writer):?boolean,
 *  object: function(!Object,Writer):?boolean,
 *  function: function(function(...*),Writer):?boolean,
 *  symbol: function(Symbol,Writer):?boolean,
 *  instance: function(!Object,Writer):?boolean,
 * }} Builders
 */
let Builders;

const AtomType = {
  AsIs: 0,
  Array: 1,
  Object: 2,
  Map: 3,
  Set: 4,
  Custom: 5,
};

const ATOM_BITS = 3;
const ATOM_BITS_MASK = (1 << ATOM_BITS) - 1;

const SerialType = {
  // these are more like flags
  ComplexAtom: 1,
  BackReference: 2,
  Int: 4,

  // these have to be above the AtomTypes
  String: (6 << 1) | 1,

  // these are straight values
  Void: 1 << 4,
  Null: 2 << 4,
  True: 3 << 4,
  False: 4 << 4,
  NaN: 5 << 4,
  Float64: 6 << 4,
};

const INT_BITS = 3;
const SERIAL_BITS = 4;

const RAW = {};
export const AS_IS = {};
const ALLOW_SELF_REFERENCE = {};
const PUSH_JUMP = {};
const POP_JUMP = {};

/////////////////////////////////////////////////////////////////////////////
// Atomizing
/////////////////////////////////////////////////////////////////////////////

export function atomizer(/** Builders */ builders) {
  const atomize = (full) => {
    const output = [];
    const refs = new Map();
    const jumps = [];

    let atomIndex = 0;
    let activeIndex = 0;
    let activeVal = RAW;

    const write = (val, secret) => {
      if (secret === RAW) {
        output.push(val);
      } else if (secret === AS_IS) {
        if (val === (val | 0)) {
          output.push(AtomType.AsIs);
        }
        output.push(val);
      } else if (secret === PUSH_JUMP) {
        jumps.push(output.push(val) - 1);
      } else if (secret === POP_JUMP) {
        const i = jumps.pop();
        const jump = output.length;
        const combined = (jump << ATOM_BITS) | output[i];
        // we use just >> instead of >>> because a negative
        // value would mean a back-reference
        if (combined >> ATOM_BITS !== jump) {
          throw new Error(`value too large to encode ${String(val)}`);
        }
        output[i] = combined;
      } else if (val === ALLOW_SELF_REFERENCE) {
        if (activeVal !== RAW) {
          if (activeIndex >= 0) {
            activeIndex = ~activeIndex;
          }

          // allows references (for now)
          refs.set(activeVal, activeIndex);

          // prevents this codepath being activated twice
          activeVal = RAW;
        }
      } else {
        if (activeIndex >= 0) {
          // will be a negative number strictly below -1
          activeIndex = ~activeIndex;

          // prevent self-references
          refs.set(activeVal, 0);
        }

        atomIndex++;

        const known = refs.get(val);
        if (known != null) {
          if (known === 0) {
            throw new Error(`infinite loop when encoding ${val}`);
          }

          output.push(known);
        } else {
          atomizeValue(val);
        }
      }
    };

    const atomizeValue = (val) => {
      let func;
      if (val === undefined) {
        func = builders.void;
      } else if (val === null) {
        func = builders.null;
      } else if (typeof val === "boolean") {
        func = builders.boolean;
      } else if (typeof val === "number") {
        func = builders.number;
      } else if (typeof val === "string") {
        func = builders.string;
      } else if (typeof val === "function") {
        func = builders.function;
      } else if (typeof val === "symbol") {
        func = builders.symbol;
      } else if (val instanceof Map) {
        func = builders.Map;
      } else if (val instanceof Set) {
        func = builders.Set;
      } else if (Array.isArray(val)) {
        func = builders.Array;
      } else {
        const proto = Object.getPrototypeOf(val);
        if (!proto || proto === Object.prototype) {
          func = builders.object;
        } else {
          func = builders.instance;
        }
      }

      const prevVal = activeVal;
      const prevIndex = activeIndex;
      const prevLength = output.length;
      activeVal = val;
      activeIndex = atomIndex;

      // write the value and save the reference to it
      // if the function returns true
      if (func(val, write)) {
        if (activeIndex >= 0) {
          refs.set(val, ~activeIndex);
        }
      } else if (activeIndex < 0) {
        refs.delete(val);
      }

      if (prevLength === output.length) {
        throw new Error(`Value encoded into nothing ${String(val)}`);
      }

      activeVal = prevVal;
      activeIndex = prevIndex;
    };

    atomizeValue(full);

    return output;
  };

  return atomize;
}

// default builders

export function encodeVoid(arg, write) {
  write(undefined, RAW);
}

export function encodeNull(arg, write) {
  write(null, RAW);
}

export function encodeBoolean(bool, write) {
  write(bool, RAW);
}

export function encodeNumber(num, write) {
  if (num === (num | 0)) {
    write(num, AS_IS);
    return true;
  } else {
    write(num, RAW);
    return num === num;
  }
}

export function encodeArray(array, write) {
  write(ALLOW_SELF_REFERENCE);
  write(AtomType.Array, PUSH_JUMP);

  const length = array.length;
  for (let i = 0; i < length; i++) {
    write(array[i]);
  }

  write(array, POP_JUMP);

  return true;
}

export function encodeString(string, write) {
  write(string, RAW);
  return true;
}

export function encodeMap(map, write) {
  write(ALLOW_SELF_REFERENCE);
  write(AtomType.Map, PUSH_JUMP);

  // write the keys
  map.forEach((val, key) => {
    write(key);
  });
  write(map, POP_JUMP);

  // write the values
  map.forEach((val) => {
    write(val);
  });

  return true;
}

export function encodeSet(set, write) {
  write(ALLOW_SELF_REFERENCE);
  write(AtomType.Set, PUSH_JUMP);
  set.forEach((val) => {
    write(val);
  });
  write(set, POP_JUMP);

  return true;
}

export function encodeObject(object, write) {
  write(ALLOW_SELF_REFERENCE);
  write(AtomType.Object, PUSH_JUMP);

  const keys = Object.keys(object);
  const length = keys.length;

  for (let i = 0; i < length; i++) {
    write(keys[i]);
  }
  write(object, POP_JUMP);

  for (let i = 0; i < length; i++) {
    write(object[keys[i]]);
  }

  return true;
}

export function customEncoder(encoder, fallback) {
  return encoder
    ? (val, write) => {
        write(AtomType.Custom, PUSH_JUMP);
        const shouldCache = encoder(val, write);
        write(val, POP_JUMP);
        return shouldCache;
      }
    : fallback;
}

/////////////////////////////////////////////////////////////////////////////
// Rebuilding
/////////////////////////////////////////////////////////////////////////////

export function rebuilder(custom) {
  function rebuild(full) {
    let nextIndex = 0;
    let length = full.length;

    const readNext = (until) => {
      if (nextIndex === until) {
        return POP_JUMP;
      }

      if (nextIndex === length) {
        throw new Error("Incomplete data");
      }

      return full[nextIndex++];
    };

    const cache = [];
    const result = nextValue(cache, custom, readNext);

    if (nextIndex !== length) {
      throw new Error("rebuilder given excess content");
    }

    return result;
  }

  return rebuild;
}

function rebuildValue(cache, custom, readNext, type) {
  if (type !== (type | 0)) {
    // it is a plain js value
    return type;
  }

  if (type < 0) {
    // it is a back-reference
    return cache[~type];
  }

  switch (type & ATOM_BITS_MASK) {
    case AtomType.AsIs:
      return readNext();
    case AtomType.Array: {
      // write the value to the cache immediately for self-referencing
      const array = [];
      cache.push(array);

      // read the values into the array
      rebuildUntil(cache, array, custom, readNext, type >> ATOM_BITS);

      return RAW;
    }
    case AtomType.Object: {
      // write the value to the cache immediately for self-referencing
      const object = {};
      cache.push(object);

      // read the keys
      const keys = [];
      rebuildUntil(cache, keys, custom, readNext, type >> ATOM_BITS);

      // populate the object
      const length = keys.length;
      for (let i = 0; i < length; i++) {
        object[keys[i]] = nextValue(cache, custom, readNext);
      }

      return RAW;
    }
    case AtomType.Map: {
      // write the value to the cache immediately for self-referencing
      const map = new Map();
      cache.push(map);

      // read the keys
      const keys = [];
      rebuildUntil(cache, keys, custom, readNext, type >> ATOM_BITS);

      // populate the map
      const length = keys.length;
      for (let i = 0; i < length; i++) {
        map.set(keys[i], nextValue(cache, custom, readNext));
      }

      return RAW;
    }
    case AtomType.Set: {
      // write the value to the cache immediately for self-referencing
      const set = new Set();
      cache.push(set);

      // read the values into the cache
      const values = [];
      rebuildUntil(cache, values, custom, readNext, type >> ATOM_BITS);

      // add them to the set
      const length = values.length;
      for (let i = 0; i < length; i++) {
        set.add(values[i]);
      }

      return RAW;
    }
    case AtomType.Custom: {
      const readValue = () => nextValue(cache, custom, readNext);
      return custom(readValue);
    }
    default:
      throw new Error(`Rebuilder TODO ${type}`);
  }
}

function nextValue(cache, custom, readNext) {
  const index = cache.length;
  const result = rebuildValue(cache, custom, readNext, readNext());
  if (result === RAW) {
    return cache[index];
  } else {
    cache.push(result);
    return result;
  }
}

function rebuildUntil(cache, results, custom, readNext, until) {
  for (let type = readNext(until); type !== POP_JUMP; type = readNext(until)) {
    const index = cache.length;
    const result = rebuildValue(cache, custom, readNext, type);
    if (result === RAW) {
      // include the value we just wrote
      results.push(cache[index]);
    } else {
      cache.push(result);
      results.push(result);
    }
  }
}

/////////////////////////////////////////////////////////////////////////////
// Binary Serialization
/////////////////////////////////////////////////////////////////////////////

export function serialize(atomized) {
  let iolist = [];

  let nextIndex = 0;
  let byteLength = 0;

  let encoder = null;

  const pushJump = (type) => {
    const index = iolist.push(0) - 1;
    const start = byteLength;
    return () => {
      let remaining = byteLength - start;
      let bits = (0x7f & (remaining << SERIAL_BITS)) | type;
      remaining >>>= 7 - SERIAL_BITS;
      if (!remaining) {
        byteLength++;
        iolist[index] = bits;
      } else {
        const bytes = [bits | 0x80];
        while (remaining) {
          bits = remaining & 0x7f;
          remaining >>>= 7;
          bytes.push(remaining ? bits | 0x80 : bits);
        }
        byteLength += bytes.length;
        iolist[index] = new Uint8Array(bytes);
      }
    };
  };

  const pushByte = (byte) => {
    byteLength++;
    iolist.push(byte);
  };

  const serializeNext = () => {
    const type = atomized[nextIndex++];

    if (type === AtomType.AsIs || type !== (type | 0)) {
      const val = type === AtomType.AsIs ? atomized[nextIndex++] : type;
      if (val !== val) {
        pushByte(SerialType.NaN);
      } else if (val === undefined) {
        pushByte(SerialType.Void);
      } else if (val === null) {
        pushByte(SerialType.Null);
      } else if (typeof val === "boolean") {
        pushByte(val ? SerialType.True : SerialType.False);
      } else if (typeof val === "number") {
        if (val === (val | 0)) {
          // twiddle negatives
          let remaining = val >= 0 ? val << 1 : (-val << 1) | 1;

          let bits = (0x7f & (remaining << INT_BITS)) | SerialType.Int;
          remaining >>>= 7 - INT_BITS;
          if (!remaining) {
            pushByte(bits);
          } else {
            const bytes = [bits | 0x80];
            while (remaining) {
              bits = remaining & 0x7f;
              remaining >>>= 7;
              bytes.push(remaining ? bits | 0x80 : bits);
            }
            byteLength += bytes.length;
            iolist.push(new Uint8Array(bytes));
          }
        } else {
          const bytes = new Uint8Array(8);
          const view = new DataView(bytes.buffer);
          view.setFloat64(0, val);

          pushByte(SerialType.Float64);
          byteLength += 8;
          iolist.push(bytes);
        }
      } else if (typeof val === "string") {
        if (!encoder) {
          encoder = new TextEncoder();
        }

        const popJump = pushJump(SerialType.String);
        const bytes = encoder.encode(val);
        byteLength += bytes.byteLength;
        iolist.push(bytes);
        popJump();
      } else {
        console.error(`TODO serialize ${String(val)}`);
      }
      return;
    }

    if (type < 0) {
      serializePosInt((~type << 2) | SerialType.BackReference, pushByte);
      return;
    }

    const atomType = type & ATOM_BITS_MASK;
    const until = type >> ATOM_BITS;
    const popJump = pushJump((atomType << 1) | SerialType.ComplexAtom);

    switch (atomType) {
      case AtomType.Array:
      case AtomType.Set:
      case AtomType.Custom: {
        while (nextIndex < until) {
          serializeNext();
        }
        popJump();
        break;
      }
      case AtomType.Object:
      case AtomType.Map: {
        let numKeys = 0;
        while (nextIndex < until) {
          numKeys++;
          serializeNext();
        }
        popJump();
        for (let i = numKeys; i > 0; i--) {
          serializeNext();
        }
        break;
      }
      default:
        // we have exhausted the list
        throw new Error(`impossible ${type}`);
    }
  };

  serializeNext();

  const bytes = new Uint8Array(byteLength);
  let outIndex = 0;
  iolist.forEach((val) => {
    if (typeof val === "number") {
      bytes[outIndex++] = val;
    } else {
      bytes.set(val, outIndex);
      outIndex += val.byteLength;
    }
  });

  return bytes;
}

function serializePosInt(int, pushByte) {
  let remaining = int;
  do {
    const bits = remaining & 0x7f;
    remaining >>>= 7;
    pushByte(remaining ? bits | 0x80 : bits);
  } while (remaining);
}

/////////////////////////////////////////////////////////////////////////////
// Binary Deserialization
/////////////////////////////////////////////////////////////////////////////

export function deserializer(custom) {
  let decoder = null;

  function deserialize(full) {
    let view = null;

    let nextIndex = 0;
    let length = full.length;
    let trickInt = null;

    // todo: loads of validation
    const readVarInt = (firstByte, trashBits) => {
      let byte = firstByte;
      let bitlength = 7 - trashBits;
      let int = (0x7f & byte) >> trashBits;
      while (byte & 0x80) {
        byte = full[nextIndex++];
        int |= (byte & 0x7f) << bitlength;
        bitlength += 7;
      }
      return int;
    };

    const readNext_ = (until) => {
      if (trickInt != null) {
        const val = trickInt;
        trickInt = null;
        return val;
      }

      if (nextIndex === until) {
        return POP_JUMP;
      }

      if (nextIndex === length) {
        throw new Error("Incomplete data");
      }

      const byte = full[nextIndex++];
      if (byte & SerialType.ComplexAtom) {
        // the other serialized types were kind of jammed in
        switch (byte & ((1 << SERIAL_BITS) - 1)) {
          case SerialType.String: {
            const length = readVarInt(byte, SERIAL_BITS);
            const endIndex = nextIndex + length;
            const str = full.subarray(nextIndex, endIndex);
            nextIndex = endIndex;

            if (!decoder) {
              decoder = new TextDecoder();
            }

            return decoder.decode(str);
          }
          default:
            // this is a complex atom type

            // blowing it up for now
            const length = readVarInt(byte, SERIAL_BITS);
            const until = nextIndex + length;
            return (until << ATOM_BITS) | (ATOM_BITS_MASK & (byte >> 1));
        }
      } else if (byte & SerialType.BackReference) {
        return ~readVarInt(byte, 2);
      } else if (byte & SerialType.Int) {
        const twiddled = readVarInt(byte, INT_BITS);
        trickInt = twiddled & 1 ? -(twiddled >>> 1) : twiddled >>> 1;
        return AtomType.AsIs;
      } else {
        switch (byte) {
          case SerialType.Void:
            return;
          case SerialType.Null:
            return null;
          case SerialType.True:
            return true;
          case SerialType.False:
            return false;
          case SerialType.NaN:
            return NaN;
          case SerialType.Float64: {
            if (!view) {
              view = new DataView(
                full.buffer,
                full.byteOffset,
                full.byteLength
              );
            }
            const float = view.getFloat64(nextIndex);
            nextIndex += 8;
            return float;
          }
          default:
            throw new Error("bad byte " + byte);
        }
      }
    };

    const readNext = (until) => {
      const before = nextIndex;
      const result = readNext_(until);
      // console.log("read", before, nextIndex, until, result);
      if (nextIndex < before) {
        throw "fail";
      }
      return result;
    };

    const cache = [];
    const result = nextValue(cache, custom, readNext);

    if (nextIndex !== length) {
      // throw new Error("deserializer given excess content");
    }

    return result;
  }

  return deserialize;
}
