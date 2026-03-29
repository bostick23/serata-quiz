import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
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

  // ===== NUOVE 100 DOMANDE =====

  // Geografia (10)
  { category: "Geografia", text: "Qual è la capitale del Canada?", choices: ["Toronto", "Vancouver", "Ottawa", "Montreal"], correctIndex: 2 },
  { category: "Geografia", text: "Quale stato africano ha Addis Abeba come capitale?", choices: ["Kenya", "Etiopia", "Nigeria", "Sudan"], correctIndex: 1 },
  { category: "Geografia", text: "Qual è il lago più grande d'Europa?", choices: ["Lago di Garda", "Lago Balaton", "Lago Ladoga", "Lago di Ginevra"], correctIndex: 2 },
  { category: "Geografia", text: "In quale paese si trova la Transilvania?", choices: ["Ungheria", "Romania", "Bulgaria", "Serbia"], correctIndex: 1 },
  { category: "Geografia", text: "Quale città è attraversata dal fiume Senna?", choices: ["Londra", "Berlino", "Parigi", "Madrid"], correctIndex: 2 },
  { category: "Geografia", text: "Quanti stati ha gli Stati Uniti d'America?", choices: ["48", "50", "51", "52"], correctIndex: 1 },
  { category: "Geografia", text: "Qual è il vulcano attivo più alto d'Europa?", choices: ["Vesuvio", "Stromboli", "Etna", "Teide"], correctIndex: 2 },
  { category: "Geografia", text: "Quale stretto separa l'Europa dall'Asia?", choices: ["Stretto di Gibilterra", "Stretto di Magellano", "Stretto del Bosforo", "Stretto di Hormuz"], correctIndex: 2 },
  { category: "Geografia", text: "In quale continente si trova il deserto di Atacama?", choices: ["Africa", "Asia", "America del Sud", "Oceania"], correctIndex: 2 },
  { category: "Geografia", text: "Qual è la nazione più estesa del mondo?", choices: ["Canada", "Cina", "Stati Uniti", "Russia"], correctIndex: 3 },

  // Storia (10)
  { category: "Storia", text: "Chi fu l'ultimo re d'Italia?", choices: ["Vittorio Emanuele II", "Umberto I", "Vittorio Emanuele III", "Umberto II"], correctIndex: 3 },
  { category: "Storia", text: "In che anno fu firmata la Magna Carta?", choices: ["1066", "1215", "1348", "1453"], correctIndex: 1 },
  { category: "Storia", text: "Quale civiltà costruì Chichén Itzá?", choices: ["Aztechi", "Inca", "Maya", "Olmechi"], correctIndex: 2 },
  { category: "Storia", text: "Chi fu il primo presidente degli Stati Uniti?", choices: ["Thomas Jefferson", "Benjamin Franklin", "George Washington", "John Adams"], correctIndex: 2 },
  { category: "Storia", text: "In che anno l'Italia divenne una Repubblica?", choices: ["1943", "1945", "1946", "1948"], correctIndex: 2 },
  { category: "Storia", text: "Quale esploratore circumnavigò il globo per primo?", choices: ["Cristoforo Colombo", "Vasco de Gama", "Ferdinando Magellano", "James Cook"], correctIndex: 2 },
  { category: "Storia", text: "La peste nera devastò l'Europa nel:", choices: ["1248", "1348", "1448", "1548"], correctIndex: 1 },
  { category: "Storia", text: "Chi era il faraone dalla tomba scoperta nel 1922?", choices: ["Ramses II", "Cleopatra", "Tutankhamon", "Akhenaton"], correctIndex: 2 },
  { category: "Storia", text: "Quale muro divideva Berlino Est e Ovest?", choices: ["Vallo di Adriano", "Muro di Berlino", "Grande Muraglia", "Linea Maginot"], correctIndex: 1 },
  { category: "Storia", text: "In che anno fu fondata Roma secondo la tradizione?", choices: ["553 a.C.", "753 a.C.", "853 a.C.", "953 a.C."], correctIndex: 1 },

  // Scienza (10)
  { category: "Scienza", text: "Quale vitamina è prodotta dall'esposizione al sole?", choices: ["Vitamina A", "Vitamina B12", "Vitamina C", "Vitamina D"], correctIndex: 3 },
  { category: "Scienza", text: "Qual è la formula chimica dell'acqua?", choices: ["CO2", "H2O", "NaCl", "O2"], correctIndex: 1 },
  { category: "Scienza", text: "Quanti cromosomi ha l'essere umano?", choices: ["23", "44", "46", "48"], correctIndex: 2 },
  { category: "Scienza", text: "Quale pianeta è noto come il 'pianeta rosso'?", choices: ["Venere", "Marte", "Giove", "Mercurio"], correctIndex: 1 },
  { category: "Scienza", text: "Chi ha formulato le leggi del moto?", choices: ["Galileo Galilei", "Isaac Newton", "Albert Einstein", "Keplero"], correctIndex: 1 },
  { category: "Scienza", text: "Qual è l'unità di misura della corrente elettrica?", choices: ["Volt", "Watt", "Ampere", "Ohm"], correctIndex: 2 },
  { category: "Scienza", text: "Da cosa è composta principalmente l'aria?", choices: ["Ossigeno e CO2", "Azoto e ossigeno", "Idrogeno e elio", "Ossigeno e argon"], correctIndex: 1 },
  { category: "Scienza", text: "Qual è il punto di congelamento dell'acqua in gradi Celsius?", choices: ["-10°C", "-5°C", "0°C", "4°C"], correctIndex: 2 },
  { category: "Scienza", text: "Quale organo produce l'insulina?", choices: ["Fegato", "Reni", "Pancreas", "Stomaco"], correctIndex: 2 },
  { category: "Scienza", text: "Qual è la velocità della luce approssimata?", choices: ["100.000 km/s", "200.000 km/s", "300.000 km/s", "400.000 km/s"], correctIndex: 2 },

  // Sport (10)
  { category: "Sport", text: "In quale sport si usa un volano?", choices: ["Tennis", "Badminton", "Squash", "Ping pong"], correctIndex: 1 },
  { category: "Sport", text: "Quale squadra di calcio è soprannominata 'i Reds'?", choices: ["Manchester United", "Arsenal", "Liverpool", "Milan"], correctIndex: 2 },
  { category: "Sport", text: "Quanti giocatori compongono una squadra di baseball in campo?", choices: ["7", "9", "10", "11"], correctIndex: 1 },
  { category: "Sport", text: "In quale paese sono nati i Giochi Olimpici?", choices: ["Italia", "Egitto", "Grecia", "Turchia"], correctIndex: 2 },
  { category: "Sport", text: "Chi ha vinto più palloni d'oro nella storia?", choices: ["Cristiano Ronaldo", "Lionel Messi", "Michel Platini", "Johan Cruyff"], correctIndex: 1 },
  { category: "Sport", text: "Quale sport pratica Tiger Woods?", choices: ["Tennis", "Cricket", "Golf", "Polo"], correctIndex: 2 },
  { category: "Sport", text: "Quanto è lungo un campo da calcio regolamentare?", choices: ["90 m", "100 m", "105 m", "110 m"], correctIndex: 2 },
  { category: "Sport", text: "In quale sport si effettua un 'slam dunk'?", choices: ["Pallavolo", "Basket", "Handball", "Football americano"], correctIndex: 1 },
  { category: "Sport", text: "Quale Gran Premio di F1 si corre a Monza?", choices: ["Gran Premio di Monza", "Gran Premio d'Italia", "Gran Premio d'Europa", "Gran Premio di Lombardia"], correctIndex: 1 },
  { category: "Sport", text: "Quante buche ha un percorso di golf standard?", choices: ["9", "12", "16", "18"], correctIndex: 3 },

  // Cinema e TV (10)
  { category: "Cinema e TV", text: "Quale film Disney racconta la storia di un leone?", choices: ["Bambi", "Il Re Leone", "Madagascar", "Alla ricerca di Nemo"], correctIndex: 1 },
  { category: "Cinema e TV", text: "Chi interpreta Iron Man nel MCU?", choices: ["Chris Evans", "Robert Downey Jr.", "Chris Hemsworth", "Mark Ruffalo"], correctIndex: 1 },
  { category: "Cinema e TV", text: "In quale saga cinematografica appare Gandalf?", choices: ["Harry Potter", "Star Wars", "Il Signore degli Anelli", "Narnia"], correctIndex: 2 },
  { category: "Cinema e TV", text: "Quale serie TV è ambientata a Westeros?", choices: ["The Witcher", "Game of Thrones", "Vikings", "Il Trono di Spade... ops, Outlander"], correctIndex: 1 },
  { category: "Cinema e TV", text: "Chi ha diretto 'Schindler's List'?", choices: ["Martin Scorsese", "Steven Spielberg", "Francis Ford Coppola", "Ridley Scott"], correctIndex: 1 },
  { category: "Cinema e TV", text: "Quale attrice interpreta Katniss Everdeen in 'Hunger Games'?", choices: ["Emma Watson", "Jennifer Lawrence", "Scarlett Johansson", "Natalie Portman"], correctIndex: 1 },
  { category: "Cinema e TV", text: "In quale anno è uscito 'Matrix'?", choices: ["1997", "1999", "2001", "2003"], correctIndex: 1 },
  { category: "Cinema e TV", text: "Quale personaggio dice 'Io sono tuo padre'?", choices: ["Obi-Wan Kenobi", "Yoda", "Darth Vader", "Palpatine"], correctIndex: 2 },
  { category: "Cinema e TV", text: "Quale regista è famoso per i colpi di scena finali?", choices: ["Christopher Nolan", "M. Night Shyamalan", "David Fincher", "Denis Villeneuve"], correctIndex: 1 },
  { category: "Cinema e TV", text: "Quanti film ci sono nella saga di 'Il Padrino'?", choices: ["2", "3", "4", "5"], correctIndex: 1 },

  // Musica (10)
  { category: "Musica", text: "Quale band ha cantato 'Stairway to Heaven'?", choices: ["Pink Floyd", "Led Zeppelin", "Deep Purple", "Black Sabbath"], correctIndex: 1 },
  { category: "Musica", text: "Chi ha composto la Nona Sinfonia?", choices: ["Mozart", "Beethoven", "Bach", "Haydn"], correctIndex: 1 },
  { category: "Musica", text: "Quale cantante è soprannominata 'Queen of Pop'?", choices: ["Whitney Houston", "Lady Gaga", "Madonna", "Beyoncé"], correctIndex: 2 },
  { category: "Musica", text: "Quante note ha la scala musicale?", choices: ["5", "6", "7", "8"], correctIndex: 2 },
  { category: "Musica", text: "Da quale città provengono i Beatles?", choices: ["Londra", "Manchester", "Liverpool", "Birmingham"], correctIndex: 2 },
  { category: "Musica", text: "Quale strumento musicale ha 88 tasti?", choices: ["Organo", "Pianoforte", "Fisarmonica", "Sintetizzatore"], correctIndex: 1 },
  { category: "Musica", text: "Chi ha cantato 'Volare' (Nel blu dipinto di blu)?", choices: ["Lucio Dalla", "Domenico Modugno", "Adriano Celentano", "Mina"], correctIndex: 1 },
  { category: "Musica", text: "Quale genere musicale è nato a New Orleans?", choices: ["Blues", "Rock", "Jazz", "Country"], correctIndex: 2 },
  { category: "Musica", text: "Chi è il frontman dei Rolling Stones?", choices: ["Keith Richards", "Mick Jagger", "Ronnie Wood", "Charlie Watts"], correctIndex: 1 },
  { category: "Musica", text: "Quale opera lirica include 'La donna è mobile'?", choices: ["La Traviata", "Rigoletto", "Aida", "Tosca"], correctIndex: 1 },

  // Cucina (10)
  { category: "Cucina", text: "Quale spezia dà il colore giallo al curry?", choices: ["Paprika", "Curcuma", "Zenzero", "Cumino"], correctIndex: 1 },
  { category: "Cucina", text: "Da quale paese proviene il kimchi?", choices: ["Giappone", "Cina", "Corea", "Thailandia"], correctIndex: 2 },
  { category: "Cucina", text: "Qual è l'ingrediente base del hummus?", choices: ["Lenticchie", "Ceci", "Fagioli", "Piselli"], correctIndex: 1 },
  { category: "Cucina", text: "Quale vino italiano è prodotto in Toscana?", choices: ["Barolo", "Chianti", "Amarone", "Prosecco"], correctIndex: 1 },
  { category: "Cucina", text: "Cos'è il wasabi?", choices: ["Un pesce", "Un'alga", "Una radice piccante", "Un fungo"], correctIndex: 2 },
  { category: "Cucina", text: "Quale dolce italiano è fatto con mascarpone e caffè?", choices: ["Panna cotta", "Cannolo", "Tiramisù", "Profiterole"], correctIndex: 2 },
  { category: "Cucina", text: "Da quale animale proviene il lardo?", choices: ["Mucca", "Pecora", "Maiale", "Capra"], correctIndex: 2 },
  { category: "Cucina", text: "Quale paese è famoso per il cous cous?", choices: ["India", "Marocco", "Grecia", "Turchia"], correctIndex: 1 },
  { category: "Cucina", text: "Come si chiama il riso giapponese per sushi?", choices: ["Basmati", "Arborio", "Jasmine", "Shari"], correctIndex: 3 },
  { category: "Cucina", text: "Qual è il formaggio francese più famoso?", choices: ["Gruyère", "Camembert", "Gouda", "Cheddar"], correctIndex: 1 },

  // Letteratura (10)
  { category: "Letteratura", text: "Chi ha scritto '1984'?", choices: ["Aldous Huxley", "George Orwell", "Ray Bradbury", "Isaac Asimov"], correctIndex: 1 },
  { category: "Letteratura", text: "Quale scrittore ha creato il personaggio di Pinocchio?", choices: ["Gianni Rodari", "Carlo Collodi", "Italo Calvino", "Edmondo De Amicis"], correctIndex: 1 },
  { category: "Letteratura", text: "In quale libro compare il capitano Achab?", choices: ["L'isola del tesoro", "Moby Dick", "Robinson Crusoe", "20.000 leghe sotto i mari"], correctIndex: 1 },
  { category: "Letteratura", text: "Chi ha scritto 'Romeo e Giulietta'?", choices: ["Molière", "Oscar Wilde", "William Shakespeare", "Lord Byron"], correctIndex: 2 },
  { category: "Letteratura", text: "Quale autore ha scritto 'Il nome della rosa'?", choices: ["Italo Calvino", "Umberto Eco", "Alberto Moravia", "Primo Levi"], correctIndex: 1 },
  { category: "Letteratura", text: "In quale romanzo appare il personaggio di D'Artagnan?", choices: ["I tre moschettieri", "Il Conte di Montecristo", "Ivanhoe", "Robin Hood"], correctIndex: 0 },
  { category: "Letteratura", text: "Chi è l'autore de 'Il piccolo principe'?", choices: ["Jules Verne", "Victor Hugo", "Antoine de Saint-Exupéry", "Albert Camus"], correctIndex: 2 },
  { category: "Letteratura", text: "Quale poeta ha scritto 'A Silvia'?", choices: ["Ugo Foscolo", "Giacomo Leopardi", "Giovanni Pascoli", "Giosuè Carducci"], correctIndex: 1 },
  { category: "Letteratura", text: "Chi ha scritto 'Don Chisciotte'?", choices: ["Cervantes", "Lope de Vega", "García Lorca", "Calderón de la Barca"], correctIndex: 0 },
  { category: "Letteratura", text: "Quale saga fantasy è stata scritta da J.R.R. Tolkien?", choices: ["Le Cronache di Narnia", "Harry Potter", "Il Signore degli Anelli", "La Ruota del Tempo"], correctIndex: 2 },

  // Natura e Animali (10)
  { category: "Natura", text: "Quale uccello è il più grande al mondo?", choices: ["Condor", "Aquila reale", "Struzzo", "Albatros"], correctIndex: 2 },
  { category: "Natura", text: "Quante zampe ha un ragno?", choices: ["6", "8", "10", "12"], correctIndex: 1 },
  { category: "Natura", text: "Quale animale può cambiare colore?", choices: ["Iguana", "Camaleonte", "Geco", "Lucertola"], correctIndex: 1 },
  { category: "Natura", text: "Qual è l'albero simbolo del Giappone?", choices: ["Bambù", "Bonsai", "Ciliegio", "Acero"], correctIndex: 2 },
  { category: "Natura", text: "Quanto può pesare un elefante africano adulto?", choices: ["2 tonnellate", "4 tonnellate", "6 tonnellate", "8 tonnellate"], correctIndex: 2 },
  { category: "Natura", text: "Quale pesce può generare scariche elettriche?", choices: ["Pesce palla", "Anguilla elettrica", "Pesce spada", "Murena"], correctIndex: 1 },
  { category: "Natura", text: "Quale animale dorme circa 22 ore al giorno?", choices: ["Gatto", "Bradipo", "Koala", "Pipistrello"], correctIndex: 2 },
  { category: "Natura", text: "Qual è il serpente più lungo del mondo?", choices: ["Anaconda", "Pitone reticolato", "Cobra reale", "Mamba nero"], correctIndex: 1 },
  { category: "Natura", text: "Quale insetto produce il miele?", choices: ["Vespa", "Ape", "Bombo", "Calabrone"], correctIndex: 1 },
  { category: "Natura", text: "Quanto vive mediamente una tartaruga gigante?", choices: ["50 anni", "80 anni", "100 anni", "150 anni"], correctIndex: 3 },

  // Tecnologia (10)
  { category: "Tecnologia", text: "Chi ha fondato Apple?", choices: ["Bill Gates", "Steve Jobs", "Mark Zuckerberg", "Jeff Bezos"], correctIndex: 1 },
  { category: "Tecnologia", text: "In che anno è stato lanciato il primo iPhone?", choices: ["2005", "2006", "2007", "2008"], correctIndex: 2 },
  { category: "Tecnologia", text: "Cosa significa l'acronimo 'URL'?", choices: ["Universal Resource Link", "Uniform Resource Locator", "United Reference Link", "Universal Reference Locator"], correctIndex: 1 },
  { category: "Tecnologia", text: "Quale azienda ha creato il sistema operativo Android?", choices: ["Apple", "Microsoft", "Google", "Samsung"], correctIndex: 2 },
  { category: "Tecnologia", text: "Cos'è il 'cloud computing'?", choices: ["Un tipo di hardware", "Servizi informatici via internet", "Un linguaggio di programmazione", "Un sistema operativo"], correctIndex: 1 },
  { category: "Tecnologia", text: "Chi ha fondato Facebook?", choices: ["Jack Dorsey", "Elon Musk", "Mark Zuckerberg", "Larry Page"], correctIndex: 2 },
  { category: "Tecnologia", text: "Cosa significa 'AI'?", choices: ["Automated Internet", "Artificial Intelligence", "Advanced Integration", "Applied Informatics"], correctIndex: 1 },
  { category: "Tecnologia", text: "Quale fu il primo motore di ricerca popolare?", choices: ["Google", "Yahoo", "Bing", "AltaVista"], correctIndex: 1 },
  { category: "Tecnologia", text: "In che anno è stato creato Wikipedia?", choices: ["1999", "2001", "2003", "2005"], correctIndex: 1 },
  { category: "Tecnologia", text: "Quale linguaggio di programmazione ha il logo di un serpente?", choices: ["Java", "Ruby", "Python", "Go"], correctIndex: 2 },
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

  // Insert questions (global, no owner) — skip duplicates by text
  let inserted = 0;
  for (const q of quizQuestions) {
    const existing = await db.select({ id: questions.id }).from(questions).where(eq(questions.text, q.text)).limit(1);
    if (existing.length > 0) continue;
    await db.insert(questions).values({
      ownerId: null,
      category: q.category,
      language: "it",
      text: q.text,
      choices: q.choices,
      correctIndex: q.correctIndex,
    });
    inserted++;
  }

  console.log(`Seeded ${inserted} new questions (${quizQuestions.length - inserted} already existed)`);
  console.log("Admin: admin@serataquiz.it / admin123");
  console.log("Host:  host@serataquiz.it / host123");

  await client.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
