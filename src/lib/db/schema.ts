import { pgTable, uuid, varchar, text, smallint, integer, timestamp, jsonb, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["host", "admin"]);
export const gameStatusEnum = pgEnum("game_status", ["lobby", "playing", "finished", "cancelled"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  role: userRoleEnum("role").default("host").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const questions = pgTable("questions", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id").references(() => users.id),
  category: varchar("category", { length: 100 }),
  text: text("text").notNull(),
  choices: jsonb("choices").$type<string[]>().notNull(),
  correctIndex: smallint("correct_index").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const games = pgTable("games", {
  id: uuid("id").defaultRandom().primaryKey(),
  hostId: uuid("host_id").references(() => users.id).notNull(),
  joinCode: varchar("join_code", { length: 8 }).notNull().unique(),
  status: gameStatusEnum("status").default("lobby").notNull(),
  numRounds: smallint("num_rounds").notNull(),
  questionsPerRound: smallint("questions_per_round").notNull(),
  currentRound: smallint("current_round").default(0).notNull(),
  currentQuestionIndex: smallint("current_question_index").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const gameQuestions = pgTable("game_questions", {
  id: uuid("id").defaultRandom().primaryKey(),
  gameId: uuid("game_id").references(() => games.id).notNull(),
  questionId: uuid("question_id").references(() => questions.id).notNull(),
  roundNumber: smallint("round_number").notNull(),
  position: smallint("position").notNull(),
  startedAt: timestamp("started_at"),
}, (table) => [
  uniqueIndex("game_round_position_idx").on(table.gameId, table.roundNumber, table.position),
]);

export const teams = pgTable("teams", {
  id: uuid("id").defaultRandom().primaryKey(),
  gameId: uuid("game_id").references(() => games.id).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  photoUrl: text("photo_url"),
  socketId: varchar("socket_id", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("game_team_name_idx").on(table.gameId, table.name),
]);

export const answers = pgTable("answers", {
  id: uuid("id").defaultRandom().primaryKey(),
  gameQuestionId: uuid("game_question_id").references(() => gameQuestions.id).notNull(),
  teamId: uuid("team_id").references(() => teams.id).notNull(),
  chosenIndex: smallint("chosen_index"),
  answeredAt: timestamp("answered_at").notNull(),
  score: integer("score").notNull(),
}, (table) => [
  uniqueIndex("answer_unique_idx").on(table.gameQuestionId, table.teamId),
]);
