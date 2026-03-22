import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { questions, users } from "./schema";
import { hashPassword } from "../auth/helpers";

const connectionString = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/serata_quiz";
const client = postgres(connectionString);
const db = drizzle(client);

const quizQuestions = [
  // Geografia
  { category: "Geografia", text: "Qual è la capitale dell'Australia?", choices: ["Sydney", "Melbourne", "Canberra", "Perth"], correctIndex: 2 },
  { category: "Geografia", text: "Qual è il fiume più lungo del mondo?", choices: ["Nilo", "Rio delle Amazzoni", "Yangzi", "Mississippi"], correctIndex: 1 },
  { category: "Geografia", text: "In quale continente si trova il deserto del Sahara?", choices: ["Asia", "Africa", "America del Sud", "Oceania"], correctIndex: 1 },
  { category: "Geografia", text: "Qual è il paese più piccolo del mondo?", choices: ["Monaco", "San Marino", "Città del Vaticano", "Liechtenstein"], correctIndex: 2 },
  { category: "Geografia", text: "Quale oceano bagna la costa occidentale dell'Africa?", choices: ["Oceano Indiano", "Oceano Pacifico", "Oceano Atlantico", "Mar Mediterraneo"], correctIndex: 2 },
  { category: "Geografia", text: "Qual è la montagna più alta del mondo?", choices: ["K2", "Monte Bianco", "Everest", "Kilimanjaro"], correctIndex: 2 },
  { category: "Geografia", text: "In quale paese si trova Machu Picchu?", choices: ["Colombia", "Perù", "Bolivia", "Ecuador"], correctIndex: 1 },
  { category: "Geografia", text: "Qual è l'isola più grande del Mediterraneo?", choices: ["Sardegna", "Creta", "Sicilia", "Corsica"], correctIndex: 2 },
  { category: "Geografia", text: "Quale paese ha più abitanti al mondo?", choices: ["Cina", "India", "Stati Uniti", "Indonesia"], correctIndex: 1 },
  { category: "Geografia", text: "Dove si trova il lago Titicaca?", choices: ["Messico", "Perù/Bolivia", "Cile", "Argentina"], correctIndex: 1 },

  // Storia
  { category: "Storia", text: "In che anno è caduto il Muro di Berlino?", choices: ["1987", "1988", "1989", "1990"], correctIndex: 2 },
  { category: "Storia", text: "Chi è stato il primo uomo a camminare sulla Luna?", choices: ["Buzz Aldrin", "Yuri Gagarin", "Neil Armstrong", "Michael Collins"], correctIndex: 2 },
  { category: "Storia", text: "In che anno è stata scoperta l'America?", choices: ["1490", "1491", "1492", "1493"], correctIndex: 2 },
  { category: "Storia", text: "Chi ha dipinto la Cappella Sistina?", choices: ["Leonardo da Vinci", "Raffaello", "Michelangelo", "Caravaggio"], correctIndex: 2 },
  { category: "Storia", text: "In che anno è iniziata la Prima Guerra Mondiale?", choices: ["1912", "1913", "1914", "1915"], correctIndex: 2 },
  { category: "Storia", text: "Chi ha scritto 'Il Principe'?", choices: ["Dante Alighieri", "Niccolò Machiavelli", "Giovanni Boccaccio", "Francesco Petrarca"], correctIndex: 1 },
  { category: "Storia", text: "L'Impero Romano d'Occidente cadde nel:", choices: ["376 d.C.", "410 d.C.", "453 d.C.", "476 d.C."], correctIndex: 3 },
  { category: "Storia", text: "Chi era il primo imperatore romano?", choices: ["Giulio Cesare", "Augusto", "Nerone", "Tiberio"], correctIndex: 1 },
  { category: "Storia", text: "La Rivoluzione Francese iniziò nel:", choices: ["1776", "1789", "1799", "1804"], correctIndex: 1 },
  { category: "Storia", text: "Chi ha inventato la stampa a caratteri mobili?", choices: ["Leonardo da Vinci", "Johannes Gutenberg", "Galileo Galilei", "Benjamin Franklin"], correctIndex: 1 },

  // Scienza
  { category: "Scienza", text: "Qual è l'elemento chimico con simbolo 'Au'?", choices: ["Argento", "Alluminio", "Oro", "Arsenico"], correctIndex: 2 },
  { category: "Scienza", text: "Quante ossa ha il corpo umano adulto?", choices: ["186", "196", "206", "216"], correctIndex: 2 },
  { category: "Scienza", text: "Qual è il pianeta più grande del sistema solare?", choices: ["Saturno", "Giove", "Nettuno", "Urano"], correctIndex: 1 },
  { category: "Scienza", text: "A che temperatura bolle l'acqua al livello del mare?", choices: ["90°C", "95°C", "100°C", "105°C"], correctIndex: 2 },
  { category: "Scienza", text: "Quale gas è più abbondante nell'atmosfera terrestre?", choices: ["Ossigeno", "Azoto", "Anidride carbonica", "Argon"], correctIndex: 1 },
  { category: "Scienza", text: "Chi ha formulato la teoria della relatività?", choices: ["Isaac Newton", "Albert Einstein", "Niels Bohr", "Max Planck"], correctIndex: 1 },
  { category: "Scienza", text: "Qual è l'organo più grande del corpo umano?", choices: ["Fegato", "Cervello", "Pelle", "Intestino"], correctIndex: 2 },
  { category: "Scienza", text: "Quanto impiega la luce del Sole a raggiungere la Terra?", choices: ["4 minuti", "8 minuti", "12 minuti", "16 minuti"], correctIndex: 1 },
  { category: "Scienza", text: "Quale scienziato ha scoperto la penicillina?", choices: ["Louis Pasteur", "Alexander Fleming", "Marie Curie", "Robert Koch"], correctIndex: 1 },
  { category: "Scienza", text: "Qual è il metallo liquido a temperatura ambiente?", choices: ["Piombo", "Mercurio", "Gallio", "Cesio"], correctIndex: 1 },

  // Sport
  { category: "Sport", text: "Quanti giocatori ha una squadra di pallavolo in campo?", choices: ["5", "6", "7", "8"], correctIndex: 1 },
  { category: "Sport", text: "In quale sport si usa il termine 'ace'?", choices: ["Calcio", "Tennis", "Basket", "Rugby"], correctIndex: 1 },
  { category: "Sport", text: "Quale paese ha vinto più Mondiali di calcio?", choices: ["Germania", "Italia", "Argentina", "Brasile"], correctIndex: 3 },
  { category: "Sport", text: "Quanto dura un tempo di una partita di basket NBA?", choices: ["10 minuti", "12 minuti", "15 minuti", "20 minuti"], correctIndex: 1 },
  { category: "Sport", text: "In quale città si sono svolte le Olimpiadi del 2020?", choices: ["Pechino", "Parigi", "Tokyo", "Londra"], correctIndex: 2 },
  { category: "Sport", text: "Quale atleta ha vinto più medaglie d'oro olimpiche?", choices: ["Usain Bolt", "Michael Phelps", "Carl Lewis", "Mark Spitz"], correctIndex: 1 },
  { category: "Sport", text: "Quanti set servono per vincere una partita di tennis al Grande Slam maschile?", choices: ["2", "3", "4", "5"], correctIndex: 1 },
  { category: "Sport", text: "In che anno l'Italia ha vinto l'ultimo Mondiale di calcio?", choices: ["2002", "2006", "2010", "2018"], correctIndex: 1 },
  { category: "Sport", text: "Quale sport pratica LeBron James?", choices: ["Football americano", "Baseball", "Basket", "Hockey"], correctIndex: 2 },
  { category: "Sport", text: "Quanti giocatori ha una squadra di rugby in campo?", choices: ["11", "13", "15", "17"], correctIndex: 2 },

  // Cinema e TV
  { category: "Cinema e TV", text: "Chi ha diretto il film 'Pulp Fiction'?", choices: ["Martin Scorsese", "Quentin Tarantino", "Steven Spielberg", "Christopher Nolan"], correctIndex: 1 },
  { category: "Cinema e TV", text: "Quale attore interpreta Jack Sparrow?", choices: ["Orlando Bloom", "Johnny Depp", "Brad Pitt", "Leonardo DiCaprio"], correctIndex: 1 },
  { category: "Cinema e TV", text: "In quale anno è uscito il primo film di Star Wars?", choices: ["1975", "1977", "1979", "1980"], correctIndex: 1 },
  { category: "Cinema e TV", text: "Quale film ha vinto l'Oscar come miglior film nel 1994?", choices: ["Pulp Fiction", "Forrest Gump", "Il Re Leone", "Le ali della libertà"], correctIndex: 1 },
  { category: "Cinema e TV", text: "Chi interpreta il Joker nel film 'Il Cavaliere Oscuro'?", choices: ["Jack Nicholson", "Jared Leto", "Heath Ledger", "Joaquin Phoenix"], correctIndex: 2 },
  { category: "Cinema e TV", text: "Quale regista è noto per il film 'La vita è bella'?", choices: ["Federico Fellini", "Roberto Benigni", "Paolo Sorrentino", "Giuseppe Tornatore"], correctIndex: 1 },
  { category: "Cinema e TV", text: "Quanti film compongono la saga di Harry Potter?", choices: ["6", "7", "8", "9"], correctIndex: 2 },
  { category: "Cinema e TV", text: "Chi è la protagonista di 'Kill Bill'?", choices: ["Angelina Jolie", "Uma Thurman", "Scarlett Johansson", "Halle Berry"], correctIndex: 1 },
  { category: "Cinema e TV", text: "In quale città è ambientato 'Friends'?", choices: ["Los Angeles", "Chicago", "New York", "Boston"], correctIndex: 2 },
  { category: "Cinema e TV", text: "Chi ha diretto 'Titanic'?", choices: ["Ridley Scott", "James Cameron", "Michael Bay", "Peter Jackson"], correctIndex: 1 },

  // Musica
  { category: "Musica", text: "Chi è il 'Re del Rock and Roll'?", choices: ["Chuck Berry", "Elvis Presley", "Little Richard", "Jerry Lee Lewis"], correctIndex: 1 },
  { category: "Musica", text: "Quale band ha cantato 'Bohemian Rhapsody'?", choices: ["Led Zeppelin", "The Beatles", "Queen", "Pink Floyd"], correctIndex: 2 },
  { category: "Musica", text: "Di quale paese è originario il tango?", choices: ["Spagna", "Brasile", "Argentina", "Messico"], correctIndex: 2 },
  { category: "Musica", text: "Chi ha composto 'Le quattro stagioni'?", choices: ["Mozart", "Bach", "Vivaldi", "Beethoven"], correctIndex: 2 },
  { category: "Musica", text: "Quale cantante italiano è noto come 'Il Volo' dei record?", choices: ["Andrea Bocelli", "Luciano Pavarotti", "Eros Ramazzotti", "Tiziano Ferro"], correctIndex: 1 },
  { category: "Musica", text: "Quante corde ha una chitarra classica?", choices: ["4", "5", "6", "7"], correctIndex: 2 },
  { category: "Musica", text: "In quale decennio è nato il genere hip-hop?", choices: ["Anni '60", "Anni '70", "Anni '80", "Anni '90"], correctIndex: 1 },
  { category: "Musica", text: "Quale strumento suonava Jimi Hendrix?", choices: ["Batteria", "Basso", "Chitarra", "Tastiera"], correctIndex: 2 },
  { category: "Musica", text: "Chi ha cantato 'Imagine'?", choices: ["Paul McCartney", "John Lennon", "George Harrison", "Mick Jagger"], correctIndex: 1 },
  { category: "Musica", text: "Quale festival musicale si tiene a Sanremo?", choices: ["Rock in Roma", "Festival di Sanremo", "Umbria Jazz", "Lucca Summer"], correctIndex: 1 },

  // Cucina e Gastronomia
  { category: "Cucina", text: "Quale formaggio si usa tradizionalmente sulla pizza Margherita?", choices: ["Parmigiano", "Gorgonzola", "Mozzarella", "Pecorino"], correctIndex: 2 },
  { category: "Cucina", text: "Da quale paese proviene il sushi?", choices: ["Cina", "Corea", "Giappone", "Thailandia"], correctIndex: 2 },
  { category: "Cucina", text: "Qual è l'ingrediente principale del guacamole?", choices: ["Pomodoro", "Peperone", "Avocado", "Cetriolo"], correctIndex: 2 },
  { category: "Cucina", text: "Quale pasta ha la forma di piccoli orecchi?", choices: ["Fusilli", "Orecchiette", "Conchiglie", "Farfalle"], correctIndex: 1 },
  { category: "Cucina", text: "Lo zafferano dà al risotto quale colore?", choices: ["Rosso", "Verde", "Giallo", "Arancione"], correctIndex: 2 },

  // Letteratura
  { category: "Letteratura", text: "Chi ha scritto la Divina Commedia?", choices: ["Petrarca", "Boccaccio", "Dante Alighieri", "Ariosto"], correctIndex: 2 },
  { category: "Letteratura", text: "Quale scrittore ha creato Sherlock Holmes?", choices: ["Agatha Christie", "Arthur Conan Doyle", "Edgar Allan Poe", "Charles Dickens"], correctIndex: 1 },
  { category: "Letteratura", text: "In quale romanzo appare il personaggio di Gatsby?", choices: ["Il vecchio e il mare", "Il grande Gatsby", "1984", "Moby Dick"], correctIndex: 1 },
  { category: "Letteratura", text: "Chi ha scritto 'I Promessi Sposi'?", choices: ["Giovanni Verga", "Alessandro Manzoni", "Luigi Pirandello", "Italo Calvino"], correctIndex: 1 },
  { category: "Letteratura", text: "Quale opera inizia con 'Nel mezzo del cammin di nostra vita'?", choices: ["Orlando Furioso", "La Gerusalemme Liberata", "La Divina Commedia", "Il Canzoniere"], correctIndex: 2 },

  // Arte
  { category: "Arte", text: "Chi ha dipinto la Gioconda?", choices: ["Raffaello", "Michelangelo", "Leonardo da Vinci", "Botticelli"], correctIndex: 2 },
  { category: "Arte", text: "In quale museo si trova la Gioconda?", choices: ["Uffizi", "British Museum", "Louvre", "Prado"], correctIndex: 2 },
  { category: "Arte", text: "Chi ha dipinto 'La notte stellata'?", choices: ["Claude Monet", "Vincent van Gogh", "Pablo Picasso", "Salvador Dalí"], correctIndex: 1 },
  { category: "Arte", text: "Quale movimento artistico è associato a Salvador Dalí?", choices: ["Cubismo", "Impressionismo", "Surrealismo", "Pop Art"], correctIndex: 2 },
  { category: "Arte", text: "Chi ha scolpito il David esposto a Firenze?", choices: ["Donatello", "Bernini", "Michelangelo", "Canova"], correctIndex: 2 },

  // Natura e Animali
  { category: "Natura", text: "Qual è il mammifero più grande del mondo?", choices: ["Elefante africano", "Balenottera azzurra", "Squalo balena", "Giraffa"], correctIndex: 1 },
  { category: "Natura", text: "Quale animale è il simbolo del WWF?", choices: ["Tigre", "Panda", "Orso polare", "Delfino"], correctIndex: 1 },
  { category: "Natura", text: "Quanti stomaci ha una mucca?", choices: ["1", "2", "3", "4"], correctIndex: 3 },
  { category: "Natura", text: "Quale fiore è il simbolo dell'Olanda?", choices: ["Rosa", "Tulipano", "Girasole", "Margherita"], correctIndex: 1 },
  { category: "Natura", text: "Qual è l'animale terrestre più veloce?", choices: ["Leone", "Ghepardo", "Gazzella", "Cavallo"], correctIndex: 1 },
];

async function seed() {
  console.log("Seeding database...");

  // Create admin user
  const adminPasswordHash = await hashPassword("admin123");
  await db.insert(users).values({
    email: "admin@serataquiz.it",
    passwordHash: adminPasswordHash,
    displayName: "Admin",
    role: "admin",
  }).onConflictDoNothing();

  // Create demo host user
  const hostPasswordHash = await hashPassword("host123");
  await db.insert(users).values({
    email: "host@serataquiz.it",
    passwordHash: hostPasswordHash,
    displayName: "Demo Host",
    role: "host",
  }).onConflictDoNothing();

  // Insert questions (global, no owner)
  for (const q of quizQuestions) {
    await db.insert(questions).values({
      ownerId: null,
      category: q.category,
      text: q.text,
      choices: q.choices,
      correctIndex: q.correctIndex,
    });
  }

  console.log(`Seeded ${quizQuestions.length} questions`);
  console.log("Admin: admin@serataquiz.it / admin123");
  console.log("Host:  host@serataquiz.it / host123");

  await client.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
