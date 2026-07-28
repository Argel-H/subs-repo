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

/**
 * Extracts metadata.created_at and metadata.updated_at from a YAML file
 * using lightweight regex parsing (no external dependencies).
 *
 * Falls back to fs.statSync(filePath).mtimeMs for both timestamps when
 * the YAML fields are missing or the file cannot be read.
 *
 * @param {string} filePath - Absolute path to the YAML file
 * @returns {{ createdAt: number, updatedAt: number }}
 */
function extractYamlMeta(filePath) {
  let createdAt;
  let updatedAt;

  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    const createdMatch = content.match(/^\s*created_at:\s*(\d+)\s*$/m);
    const updatedMatch = content.match(/^\s*updated_at:\s*(\d+)\s*$/m);

    if (createdMatch) {
      createdAt = Number(createdMatch[1]);
    }
    if (updatedMatch) {
      updatedAt = Number(updatedMatch[1]);
    }
  } catch {
  }

  // fallback
  if (createdAt === undefined || updatedAt === undefined) {
    try {
      const stat = fs.statSync(filePath);
      const mtime = stat.mtimeMs;
      if (createdAt === undefined) createdAt = mtime;
      if (updatedAt === undefined) updatedAt = mtime;
    } catch {
      const now = Date.now();
      if (createdAt === undefined) createdAt = now;
      if (updatedAt === undefined) updatedAt = now;
    }
  }

  return { createdAt, updatedAt };
}

/**
 * Builds a track object with title, fileSize, and YAML metadata timestamps.
 *
 * @param {string} filePath - Absolute path to the YAML file
 * @param {string} title    - Track title (filename without extension)
 * @returns {{ title: string, fileSize: number, createdAt: number, updatedAt: number }}
 */
function buildTrackObject(filePath, title) {
  const stat = fs.statSync(filePath);
  const meta = extractYamlMeta(filePath);

  return {
    title,
    fileSize: stat.size,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt
  };
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
        totalTracks: 0,
        totalSingles: 0,
        totalAlbumTracks: 0,
        totalFileSize: 0,
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
          const albumTrackFiles = fs
            .readdirSync(childPath)
            .filter((file) => !file.startsWith('.'));

          const tracks = albumTrackFiles.map((file) => {
            const filePath = path.join(childPath, file);
            const title = path.parse(file).name;
            return buildTrackObject(filePath, title);
          });

          const trackCount = tracks.length;
          const totalFileSize = tracks.reduce((sum, t) => sum + t.fileSize, 0);

          artistData.albums.push({
            name: albumName,
            trackCount,
            totalFileSize,
            tracks
          });

          artistData.totalAlbumTracks += trackCount;
          artistData.totalFileSize += totalFileSize;
        } else {
          const title = path.parse(child).name;
          const track = buildTrackObject(childPath, title);
          artistData.singles.push(track);

          artistData.totalSingles += 1;
          artistData.totalFileSize += track.fileSize;
        }
      });

      artistData.totalTracks = artistData.totalSingles + artistData.totalAlbumTracks;

      const artistFileName = `${artistSlug}.json`;
      fs.writeFileSync(
        path.join(ARTISTS_DIR, artistFileName),
        JSON.stringify(artistData, null, 2)
      );

      indexList.push({
        name: artistName,
        slug: artistSlug,
        file: `artists/${artistFileName}`,
        totalTracks: artistData.totalTracks,
        totalSingles: artistData.totalSingles,
        totalAlbums: artistData.albums.length,
        totalFileSize: artistData.totalFileSize
      });
    }
  });

  fs.writeFileSync(
    path.join(DIST_DIR, 'index.json'),
    JSON.stringify(indexList, null, 2)
  );
}

build();
