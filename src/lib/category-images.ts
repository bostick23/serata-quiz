const categoryImages: Record<string, string> = {
  // Italian
  "Geografia": "/categories/globe.svg",
  "Storia": "/categories/scroll.svg",
  "Scienza": "/categories/science.svg",
  "Sport": "/categories/sport.svg",
  "Cinema e TV": "/categories/film.svg",
  "Musica": "/categories/music.svg",
  "Cucina": "/categories/cooking.svg",
  "Letteratura": "/categories/book.svg",
  "Natura": "/categories/nature.svg",
  "Tecnologia": "/categories/technology.svg",
  "Arte": "/categories/art.svg",
  "Cartoni Animati": "/categories/cartoon.svg",
  // English (OpenTDB)
  "General Knowledge": "/categories/brain.svg",
  "Entertainment: Books": "/categories/book.svg",
  "Entertainment: Film": "/categories/film.svg",
  "Entertainment: Music": "/categories/music.svg",
  "Entertainment: Musicals & Theatres": "/categories/theater.svg",
  "Entertainment: Television": "/categories/tv.svg",
  "Entertainment: Video Games": "/categories/gamepad.svg",
  "Entertainment: Board Games": "/categories/dice.svg",
  "Science & Nature": "/categories/science.svg",
  "Science: Computers": "/categories/technology.svg",
  "Science: Mathematics": "/categories/math.svg",
  "Science: Gadgets": "/categories/phone.svg",
  "Mythology": "/categories/lightning.svg",
  "Sports": "/categories/sport.svg",
  "Geography": "/categories/globe.svg",
  "History": "/categories/scroll.svg",
  "Politics": "/categories/building.svg",
  "Art": "/categories/art.svg",
  "Celebrities": "/categories/star.svg",
  "Animals": "/categories/paw.svg",
  "Vehicles": "/categories/car.svg",
  "Entertainment: Comics": "/categories/comic.svg",
  "Entertainment: Japanese Anime & Manga": "/categories/anime.svg",
  "Entertainment: Cartoon & Animations": "/categories/cartoon.svg",
};

export function getCategoryImage(category: string): string {
  return categoryImages[category] ?? "/categories/default.svg";
}
