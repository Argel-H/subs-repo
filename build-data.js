const fs = require('fs');
const path = require('path');

// CONFIG

const ROOT_DIR = process.cwd();
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const ARTISTS_DIR = path.join(DIST_DIR, 'artists');

const IGNORE_LIST = new Set([
  '.git',
  '.github',
  'node_modules',
  'dist',
  'build-data.js',
  '.gitignore',
  'README.md'
]);

///////////////////////////////////////////////////////////////

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

function build() {
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(ARTISTS_DIR, { recursive: true });

  const rootItems = fs.readdirSync(ROOT_DIR);
  const indexList = [];

  rootItems.forEach((item) => {
    if (IGNORE_LIST.has(item) || item.startsWith('.')) return;

    const artistPath = path.join(ROOT_DIR, item);
    const stat = fs.statSync(artistPath);

    if (stat.isDirectory()) {
      const artistName = item;
      const artistSlug = slugify(artistName);
      const artistData = {
        artist: artistName,
        singles: [],
        albums: []
      };

      const artistContents = fs.readdirSync(artistPath);

      artistContents.forEach((child) => {
        if (child.startsWith('.')) return;

        const childPath = path.join(artistPath, child);
        const childStat = fs.statSync(childPath);

        if (childStat.isDirectory()) {
          const albumName = child;
          const tracks = fs
            .readdirSync(childPath)
            .filter((file) => !file.startsWith('.'))
            .map((file) => path.parse(file).name);

          artistData.albums.push({
            name: albumName,
            tracks: tracks
          });
        } else {
          const title = path.parse(child).name;
          artistData.singles.push(title);
        }
      });

      const artistFileName = `${artistSlug}.json`;
      fs.writeFileSync(
        path.join(ARTISTS_DIR, artistFileName),
        JSON.stringify(artistData, null, 2)
      );

      indexList.push({
        name: artistName,
        slug: artistSlug,
        file: `artists/${artistFileName}`
      });
    }
  });

  fs.writeFileSync(
    path.join(DIST_DIR, 'index.json'),
    JSON.stringify(indexList, null, 2)
  );
}

build();
