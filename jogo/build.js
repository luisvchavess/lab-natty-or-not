#!/usr/bin/env node
/* Build do Fusca a Jato.
   Gera:
   - index.html            documento completo, tudo embutido (abre direto no navegador / GitHub Pages)
   - dist/artifact.html    mesmo conteúdo sem <html>/<head>/<body> (para publicar como Artifact)
   - dev.html              carrega os arquivos de src/ separados (para desenvolver; aceita ?mods=art,bg)
   Uso: node build.js */
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
// Ordem importa: data -> core -> módulos -> main
const JS = ['data', 'core', 'art', 'bg', 'audio', 'enemies', 'stages', 'bosses', 'lule', 'ui', 'main'];
const CSS = ['base', 'ui'];

const shell = fs.readFileSync(path.join(SRC, 'shell.html'), 'utf8');
const [headPart, bodyPart] = shell.split('<!--BODY-->');

const exists = (p) => fs.existsSync(p);
const jsFiles = JS.map((n) => path.join(SRC, 'js', n + '.js')).filter(exists);
const cssFiles = CSS.map((n) => path.join(SRC, 'css', n + '.css')).filter(exists);

const css = cssFiles.map((f) => '/* ' + path.basename(f) + ' */\n' + fs.readFileSync(f, 'utf8')).join('\n');
const js = jsFiles.map((f) => {
  const code = fs.readFileSync(f, 'utf8').replace(/<\/script/gi, '<\\/script');
  return '<script>/* ' + path.basename(f) + ' */\n' + code + '\n</script>';
}).join('\n');

const head = headPart.replace('<!--CSS-->', '<style>\n' + css + '\n</style>');
const body = bodyPart.replace('<!--SCRIPTS-->', js);

const full = '<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n'
  + '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">\n'
  + '<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="mobile-web-app-capable" content="yes">\n'
  + head + '\n</head>\n<body>\n' + body + '\n</body>\n</html>\n';
fs.writeFileSync(path.join(ROOT, 'index.html'), full);

fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist', 'artifact.html'), head + '\n' + body + '\n');

// dev.html: scripts separados, filtro opcional ?mods=art,bg (data, core e main sempre carregam)
const devCss = cssFiles.map((f) => '<link rel="stylesheet" href="src/css/' + path.basename(f) + '">').join('\n');
const devHead = headPart.replace('<!--CSS-->', devCss);
const devLoader = '<script>(function(){var all=' + JSON.stringify(JS) + ';var q=new URLSearchParams(location.search);var m=q.get("mods");'
  + 'var keep=m?m.split(","):null;all.forEach(function(n){if(keep&&["data","core","main"].indexOf(n)<0&&keep.indexOf(n)<0)return;'
  + 'document.write(\'<script src="src/js/\'+n+\'.js?v=\'+Date.now()+\'"><\\/script>\');});})();</script>';
const devBody = bodyPart.replace('<!--SCRIPTS-->', devLoader);
const dev = '<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n'
  + '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">\n'
  + devHead + '\n</head>\n<body>\n' + devBody + '\n</body>\n</html>\n';
fs.writeFileSync(path.join(ROOT, 'dev.html'), dev);

const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(1) + ' KB';
console.log('index.html', kb(full), '| módulos:', jsFiles.map((f) => path.basename(f, '.js')).join(', '));
