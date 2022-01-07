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
 *  array: function(Array<*>,Writer):?boolean,
 *  string: function(string,Writer):?boolean,
 * }} Builders
 */
let Builders;

/**
 * @enum {number}
 */
const EncodeType = {
  Void: 1 << 1,
  Null: 2 << 1,
  True: 3 << 1,
  False: 4 << 1,
  NaN: 5 << 1,
  Int: 6 << 1,
  Float64: 7 << 1,
  Array: 8 << 1,
};

const RAW = {};
export const ALLOW_SELF_REFERENCE = {};

/////////////////////////////////////////////////////////////////////////////
// Atomizing
/////////////////////////////////////////////////////////////////////////////

export function atomizer(/** Builders */ builders) {
  const atomize = (full) => {
    const output = [];
    const refs = new Map();

    let activeIndex = 0;
    let activeVal = RAW;

    const write = (val, secret) => {
      if (secret === RAW) {
        output.push(val);
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
      } else if (Array.isArray(val)) {
        func = builders.array;
      } else {
        throw new Error("TODO");
      }

      const prevVal = activeVal;
      const prevIndex = activeIndex;
      activeVal = val;
      activeIndex = output.length;

      // write the value and save the reference to it
      // if the function returns true
      if (func(val, write)) {
        refs.set(val, activeIndex >= 0 ? (activeIndex << 1) | 1 : -activeIndex);
      } else if (activeIndex < 0) {
        refs.delete(val);
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
    write(EncodeType.Int, RAW);
    write(num, RAW);
    return true;
  } else {
    write(EncodeType.Float64, RAW);
    write(num, RAW);
    return true;
  }
}

export function encodeArray(array, write) {
  write(ALLOW_SELF_REFERENCE);
  write(EncodeType.Array, RAW);

  const length = array.length;
  write(length, RAW);

  for (let i = 0; i < length; i++) {
    write(array[i]);
  }

  return true;
}

export function encodeString(string, write) {
  write(EncodeType.String, RAW);
  write(string, RAW);
  return true;
}

/////////////////////////////////////////////////////////////////////////////
// Rebuilding
/////////////////////////////////////////////////////////////////////////////

export function rebuilder(options) {}
