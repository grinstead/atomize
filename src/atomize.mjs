/**
 * @typedef {function(*,*):void} Writer
 */
let Writer;

/**
 * The type for all the builders that are availabe to the atomizer
 * @typedef {{
 *  void: function(Writer),
 *  null: function(Writer),
 *  boolean: function(boolean,Writer),
 * }} Builders
 */
let Builders;

const EncodeType = {
  Void: -1,
  Null: -2,
  True: -3,
  False: -4,
  NaN: -5,

  Array: 1,
  Map: 2,
  Hash: 3,
  Set: 4,
  Custom: 5,
};

const RAW = {};

/////////////////////////////////////////////////////////////////////////////
// Atomizing
/////////////////////////////////////////////////////////////////////////////

export function atomizer(/** Builders */ builders) {
  const atomize = (full) => {
    const output = [];
    const refs = new Map();
    const stack = [];

    let activeIndex = 0;
    let activeVal = full;

    const write = (val, secret) => {
      if (secret === RAW) {
        output.push(val);
      } else if (val === activeVal) {
        refs.set(val, activeIndex);
      } else {
        atomizeValue(val);
      }
    };

    const atomizeValue = (val) => {
      const prevVal = activeVal;
      const prevIndex = activeIndex;

      activeVal = val;
      activeIndex = output.length;

      if (val === undefined) {
        builders.void(write);
      } else if (val === null) {
        builders.null(write);
      } else if (typeof val === "boolean") {
        builders.boolean(val, write);
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

/////////////////////////////////////////////////////////////////////////////
// Rebuilding
/////////////////////////////////////////////////////////////////////////////

export function rebuilder(options) {}
