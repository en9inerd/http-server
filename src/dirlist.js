import path from 'node:path';
import fs from 'node:fs/promises';

const htmlEntities = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
};

function htmlescape(s) {
  return s.replace(/[&<>"']/g, m => htmlEntities[m]);
}

// f(filename :string, pathname :string, opts :DirlistOptions) :Promise<string>
export async function createDirectoryListingHTML(filename, pathname, opts) {
  const ents = await fs.readdir(filename, {withFileTypes:true, encoding:'utf8'});
  const files = [];
  for (const f of ents) {
    let name = f.name;
    if (!opts.showHidden && name[0] == '.') {
      continue;
    }

    let extra = '';
    if (f.isDirectory()) {
      name += '/';
    } else if (f.isSymbolicLink()) {
      try {
        const target = await fs.readlink(path.join(filename, f.name));
        extra = ` <span class="symlink" title="symlink">&rarr; ${htmlescape(target)}</span>`;
      } catch (_) { /* empty */ };
    }

    files.push(`<li><a href="${encodeURI(pathname + name)}">${htmlescape(name)}</a>${extra}</li>`);
  }

  if (pathname != '/') {
    files.unshift('<li><a href="..">..</a></li>');
  }

  let title = [];
  const pathComponents = pathname.split('/').filter(s => s.length > 0);
  let pardir = '/';
  for (const c of pathComponents) {
    const dir = pardir + c + '/';
    pardir = dir;
    title.push(`<a href="${htmlescape(dir)}">${htmlescape(c)}</a>`);
  }
  title = `<a href="/">/</a>${title.join('/')}`;

  return `<!DOCTYPE html>
<html>
  <meta charset="utf-8">
  <title>${htmlescape(pathname)}</title>
  <style>
    body { font-family:monospace; line-height:1.4; padding:2em }
    ul { list-style:none;padding:0 }
    a { text-decoration: none }
    a:hover { text-decoration: underline }
    .symlink { opacity:0.5 }
  </style>
  <body>
    <h1>${title}</h1>
    <ul>
      ${files.join('\n      ')}
    </ul>
  </body>
</html>\n`;
}
