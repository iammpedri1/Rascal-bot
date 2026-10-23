const fallbackGifs = {
  win: "https://media.tenor.com/-3I9mCC9QvgAAAAC/anime-happy.gif",
  lose: "https://media.tenor.com/r9aU2x9h5YQAAAAC/anime-cry.gif",
  draw: "https://media.tenor.com/mCiM7CmGGI4AAAAC/anime-stare.gif",
};

const categories = {
  win: ["happy", "dance", "laugh", "thumbsup"],
  lose: ["cry", "facepalm", "pout"],
  draw: ["stare", "think", "shrug"],
};

async function getAnimeGif(type) {
  const list = categories[type] || categories.win;
  const category = list[Math.floor(Math.random() * list.length)];

  try {
    const res = await fetch(`https://nekos.best/api/v2/${category}`);
    const data = await res.json();
    return data.results?.[0]?.url || fallbackGifs[type] || fallbackGifs.win;
  } catch {
    return fallbackGifs[type] || fallbackGifs.win;
  }
}

module.exports = { getAnimeGif };
