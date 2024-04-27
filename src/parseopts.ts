import { die } from './util.js';

export function parseopts(
  argv: string[],
  opts: Record<string, boolean | string | number>,
  usage: CallableFunction
) {
  const args = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg[0] === '-') {
      let k = arg.replace(/^-+/, '');
      if (k === 'h' || k === 'help') {
        usage();
      }
      if (!(k in opts)) {
        k = k.replace(/-(\w)/g, (_: string, m: string[]) => m[0].toUpperCase());
      }
      if (k in opts) {
        const t = typeof opts[k];
        let v: boolean | string | number = true;
        if (t !== 'boolean') {
          v = argv[++i];
          if (v === undefined) {
            die(`missing value for option ${arg}`);
          }
          if (t === 'number') {
            v = Number(v);
            if (Number.isNaN(v)) {
              die(`invalid value ${argv[i]} for option ${arg} (not a number)`);
            }
          }
        }
        opts[k] = v;
      } else {
        die(`unknown option ${arg}`);
      }
    } else {
      args.push(arg);
    }
  }
  return args;
}
