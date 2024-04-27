// type Formatter = (v :any, n? :number) => any
import { inspect } from 'node:util';

const formatters = {
  s: String,
  j: JSON.stringify,
  // biome-ignore lint/suspicious/noExplicitAny: JSON.stringify argument is any
  j_: (v: any, n?: string | number) => JSON.stringify(v, null, n),
  r: inspect,
  r_: inspect,
  // biome-ignore lint/suspicious/noExplicitAny: JSON.stringify argument is any
  q: (v: any) => JSON.stringify(String(v)),
  n: Number,
  f: Number,
  // biome-ignore lint/suspicious/noExplicitAny: Number argument is any
  f_: (v: any, n?: number) => Number(v).toFixed(n),
  i: Math.round,
  d: Math.round,
  x: (v: number) => Math.round(v).toString(16),
  X: (v: number) => Math.round(v).toString(16).toUpperCase(),
};

// fmt formats a string
//
// Format specifiers:
//
//  %s       String(value)
//  %r       inspect(value)
//  %Nr      inspect(value, maxdepth=N)
//  %j       JSON.stringify(value)
//  %jN      JSON.stringify(value, null, N)
//  %q       JSON.stringify(String(value))
//  %n, %f   Number(value)
//  %fN      Number(value).toFixed(N)
//  %i, %d   Math.round(value)
//  %x       Math.round(value).toString(16)
//  %X       Math.round(value).toString(16).toUpperCase()
//  %%       "%"
//
// A value that is a function is called and its return value is used.
//
// fmt(format :string, ...args :any[]) :string
export function fmt(format: string, ...args: string[]): string {
  let index = 0;
  let s = format.replace(/%(?:([sjrqnfidxX%])|(\d+)([jrf]))/g, (_, ...m: string[]) => {
    let spec = m[0];
    if (spec === '%') {
      return '%';
    } else if (!spec) {
      // with leading number
      spec = m[2];
    }
    if (index === args.length) {
      throw new Error(`superfluous parameter %${spec} at offset ${m[3]}`);
    }
    let v = args[index++];
    if (typeof v === 'function') {
      v = (<CallableFunction>v)();
    }

    // @ts-ignore
    return m[0] ? formatters[spec](v) : formatters[`${spec}_`](v, Number.parseInt(m[1]));
  });
  if (index < args.length) {
    // throw new Error(`superfluous arguments`)
    s += `(fmt:extra ${args.slice(index).map(v => `${typeof v}=${v}`).join(', ')})`;
  }
  return s;
}

