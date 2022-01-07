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

/**
 * Internal only. Exported so that index.js can use it
 * @enum {number}
 */
export const EncodeType = {
  Void: 1 << 1,
  Null: 2 << 1,
  True: 3 << 1,
  False: 4 << 1,
  NaN: 5 << 1,
  Raw: 6 << 1,
  Array: 7 << 1,
  Object: 8 << 1,
  Map: 9 << 1,
  Set: 10 << 1,
  Custom: 11 << 1,
};

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
        output.push(EncodeType.Raw, val);
      } else if (val === ALLOW_SELF_REFERENCE) {
        if (activeVal !== RAW) {
          if (activeIndex >= 0) {
            activeIndex = ~(activeIndex << 1);
          }

          // allows references (for now)
          refs.set(activeVal, -activeIndex);

          // prevents this codepath being activated twice
          activeVal = RAW;
        }
      } else if (val === PUSH_JUMP) {
        jumps.push(output.push(0) - 1);
      } else if (val === POP_JUMP) {
        output[jumps.pop()] = output.length;
      } else {
        if (activeIndex >= 0) {
          // will be a negative number strictly below -1
          activeIndex = ~(activeIndex << 1);

          // prevent self-references
          refs.set(val, -1);
        }

        const known = refs.get(val);
        if (known != null) {
          if (known === -1) {
            throw new Error(`Infinite loop when encoding ${val}`);
          }

          atomIndex++;
          output.push(known >= 0 ? known : -known);
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
      activeIndex = atomIndex++;

      // write the value and save the reference to it
      // if the function returns true
      if (func(val, write)) {
        refs.set(val, activeIndex >= 0 ? (activeIndex << 1) | 1 : -activeIndex);
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

export function encodeVoid(write) {
  write(EncodeType.Void, RAW);
}

export function encodeNull(write) {
  write(EncodeType.Null, RAW);
}

export function encodeBoolean(bool, write) {
  write(bool ? EncodeType.True : EncodeType.False, RAW);
}

export function encodeNumber(num, write) {
  if (num !== num) {
    write(EncodeType.NaN, RAW);
    return false;
  } else if (num === (num | 0)) {
    write(num, AS_IS);
    return true;
  } else {
    write(num, AS_IS);
    return true;
  }
}

export function encodeArray(array, write) {
  write(ALLOW_SELF_REFERENCE);
  write(EncodeType.Array, RAW);
  write(PUSH_JUMP);

  const length = array.length;
  for (let i = 0; i < length; i++) {
    write(array[i]);
  }

  write(POP_JUMP);

  return true;
}

export function encodeString(string, write) {
  write(string, AS_IS);
  return true;
}

export function encodeMap(map, write) {
  write(ALLOW_SELF_REFERENCE);
  write(EncodeType.Map, RAW);

  write(PUSH_JUMP);
  map.forEach((val, key) => {
    write(key);
  });
  write(POP_JUMP);

  map.forEach((val) => {
    write(val);
  });

  return true;
}

export function encodeSet(set, write) {
  write(ALLOW_SELF_REFERENCE);
  write(EncodeType.Set, RAW);
  write(PUSH_JUMP);
  set.forEach((val) => {
    write(val);
  });
  write(POP_JUMP);

  return true;
}

export function encodeObject(object, write) {
  write(ALLOW_SELF_REFERENCE);
  write(EncodeType.Object, RAW);

  const keys = Object.keys(object);
  const length = keys.length;

  write(PUSH_JUMP);
  for (let i = 0; i < length; i++) {
    write(keys[i]);
  }
  write(POP_JUMP);

  for (let i = 0; i < length; i++) {
    write(object[keys[i]]);
  }

  return true;
}

export function customEncoder(encoder, fallback) {
  return encoder
    ? (val, write) => {
        write(EncodeType.Custom, RAW);
        return encoder(val, write);
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

function rebuildValue(cache, custom, readNext, outerUntil) {
  // this will definitely be a type, at least for now
  const type = readNext(outerUntil);
  if (type === POP_JUMP) {
    return POP_JUMP; // do not write
  }

  if (type & 1) {
    // it is a back-reference
    return cache[type >> 1];
  }

  switch (type) {
    case EncodeType.Void:
      return undefined;
    case EncodeType.Null:
      return null;
    case EncodeType.True:
      return true;
    case EncodeType.False:
      return false;
    case EncodeType.NaN:
      return NaN;
    case EncodeType.Raw:
      return readNext();
    case EncodeType.Array: {
      // write the value to the cache immediately for self-referencing
      const array = [];
      const start = cache.push(array);

      // read the values into the cache
      const end = rebuildUntil(cache, custom, readNext, readNext());

      // push them onto the array
      for (let i = start; i < end; i++) {
        array.push(cache[i]);
      }

      return RAW;
    }
    case EncodeType.Object: {
      // write the value to the cache immediately for self-referencing
      const object = {};
      const start = cache.push(object);

      // read the keys
      const end = rebuildUntil(cache, custom, readNext, readNext());

      // populate the object
      for (let i = start; i < end; i++) {
        object[cache[i]] = nextValue(cache, custom, readNext);
      }

      return RAW;
    }
    case EncodeType.Map: {
      // write the value to the cache immediately for self-referencing
      const map = new Map();
      const start = cache.push(map);

      // read the keys
      const end = rebuildUntil(cache, custom, readNext, readNext());

      // populate the map
      for (let i = start; i < end; i++) {
        map.set(cache[i], nextValue(cache, custom, readNext));
      }

      return RAW;
    }
    case EncodeType.Set: {
      // write the value to the cache immediately for self-referencing
      const set = new Set();
      const start = cache.push(set);

      // read the values into the cache
      const end = rebuildUntil(cache, custom, readNext, readNext());

      // add them to the set
      for (let i = start; i < end; i++) {
        set.add(cache[i]);
      }

      return RAW;
    }
    case EncodeType.Custom: {
      const readValue = () => nextValue(cache, custom, readNext);
      return custom(readValue);
    }
    default:
      throw new Error(`Rebuilder TODO ${type}`);
  }
}

function nextValue(cache, custom, readNext) {
  const index = cache.length;
  const result = rebuildValue(cache, custom, readNext, -1);
  if (result === RAW) {
    return cache[index];
  } else {
    cache.push(result);
    return result;
  }
}

function rebuildUntil(cache, custom, readNext, until) {
  let endIndex = cache.length;
  let result = RAW;

  while (result !== POP_JUMP) {
    result = rebuildValue(cache, custom, readNext, until);
    if (result === RAW) {
      // include the value we just wrote
      endIndex++;
    } else if (result !== POP_JUMP) {
      endIndex = cache.push(result);
    }
  }

  return endIndex;
}
