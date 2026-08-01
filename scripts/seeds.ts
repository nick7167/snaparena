/**
 * Category definitions and their seed artists.
 *
 * We seed by *artist* rather than by genre keyword: iTunes genre searches return
 * a great deal of karaoke, tribute and library-music pollution, whereas an artist
 * search returns that artist's actual catalogue ranked by relevance. Since the
 * playable pool is meant to be "songs a lot of people know", a curated artist list
 * is the correct input.
 *
 * Extend the lists freely — ingest dedupes and re-tiers on every run.
 */

export interface CategorySeed {
  readonly slug: string;
  readonly name: string;
  readonly sortOrder: number;
  /** iTunes `primaryGenreName` values that corroborate a track belongs here. */
  readonly genreHints: readonly string[];
  /** Inclusive release-year window, or null when the category is not era-bound. */
  readonly yearRange: readonly [number, number] | null;
  readonly artists: readonly string[];
}

export const CATEGORY_SEEDS: readonly CategorySeed[] = [
  {
    slug: "pop-2010s",
    name: "2010s Pop",
    sortOrder: 1,
    genreHints: ["Pop", "Dance", "Electronic"],
    yearRange: [2010, 2019],
    artists: [
      "Taylor Swift", "Ed Sheeran", "Adele", "Bruno Mars", "Katy Perry",
      "Lady Gaga", "Justin Bieber", "Ariana Grande", "Maroon 5", "Sia",
      "Dua Lipa", "The Chainsmokers", "Calvin Harris", "Rihanna", "Sam Smith",
      // Also seeded in 2020s Pop. Listed here too because "Blinding Lights"
      // is a 2019 release and the era filter would otherwise drop it.
      "The Weeknd",
    ],
  },
  {
    slug: "pop-2020s",
    name: "2020s Pop",
    sortOrder: 9,
    genreHints: ["Pop", "Dance", "R&B/Soul"],
    yearRange: [2020, 2030],
    artists: [
      "The Weeknd", "Billie Eilish", "Olivia Rodrigo", "Harry Styles", "Doja Cat",
      "SZA", "Sabrina Carpenter", "Miley Cyrus", "Lil Nas X", "Glass Animals",
      "Chappell Roan", "Hozier", "Benson Boone", "Tate McRae", "Teddy Swims",
    ],
  },
  {
    slug: "hip-hop",
    name: "Hip-Hop",
    sortOrder: 2,
    genreHints: ["Hip-Hop/Rap", "Rap"],
    yearRange: null,
    artists: [
      "Drake", "Kendrick Lamar", "Eminem", "Kanye West", "Travis Scott",
      "Jay-Z", "Nicki Minaj", "Cardi B", "Post Malone", "Snoop Dogg",
      "50 Cent", "Notorious B.I.G.", "Tupac", "Missy Elliott", "Outkast",
    ],
  },
  {
    slug: "rock",
    name: "Rock",
    sortOrder: 3,
    genreHints: ["Rock", "Alternative", "Hard Rock"],
    yearRange: null,
    artists: [
      "Queen", "The Beatles", "Nirvana", "Fleetwood Mac", "Led Zeppelin",
      "The Rolling Stones", "Red Hot Chili Peppers", "Foo Fighters", "AC/DC",
      "Arctic Monkeys", "The Killers", "Green Day", "Pink Floyd", "Oasis", "Radiohead",
    ],
  },
  {
    slug: "country",
    name: "Country",
    sortOrder: 4,
    genreHints: ["Country"],
    yearRange: null,
    artists: [
      "Johnny Cash", "Dolly Parton", "Luke Combs", "Carrie Underwood",
      "Morgan Wallen", "Chris Stapleton", "Shania Twain", "Garth Brooks",
      "Kacey Musgraves", "Zach Bryan", "Willie Nelson", "Blake Shelton",
    ],
  },
  {
    slug: "latin",
    name: "Latin",
    sortOrder: 5,
    genreHints: ["Latin", "Latin Urban", "Reggaeton"],
    yearRange: null,
    artists: [
      "Bad Bunny", "Shakira", "J Balvin", "Daddy Yankee", "Karol G",
      "Luis Fonsi", "Maluma", "Rosalía", "Ozuna", "Enrique Iglesias",
      "Marc Anthony", "Selena",
    ],
  },
  {
    slug: "k-pop",
    name: "K-Pop",
    sortOrder: 6,
    genreHints: ["K-Pop", "Pop"],
    yearRange: null,
    artists: [
      "BTS", "BLACKPINK", "TWICE", "Stray Kids", "NewJeans",
      "EXO", "Red Velvet", "SEVENTEEN", "IU", "PSY", "aespa", "ITZY",
    ],
  },
  {
    slug: "metal",
    name: "Metal",
    sortOrder: 7,
    genreHints: ["Metal", "Hard Rock", "Rock"],
    yearRange: null,
    artists: [
      "Metallica", "Iron Maiden", "Black Sabbath", "Slipknot", "System of a Down",
      "Megadeth", "Pantera", "Rammstein", "Tool", "Judas Priest", "Ozzy Osbourne",
    ],
  },
  {
    slug: "nineties",
    name: "90s",
    sortOrder: 8,
    genreHints: ["Pop", "Rock", "R&B/Soul", "Hip-Hop/Rap", "Alternative"],
    yearRange: [1990, 1999],
    artists: [
      "Backstreet Boys", "Spice Girls", "TLC", "Mariah Carey", "Whitney Houston",
      "Britney Spears", "Alanis Morissette", "R.E.M.", "Blur", "No Doubt",
      "Destiny's Child", "Boyz II Men", "Smashing Pumpkins", "Aerosmith",
    ],
  },
];
