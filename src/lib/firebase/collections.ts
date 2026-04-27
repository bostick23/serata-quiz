import { db } from "./index";
import { Timestamp } from "firebase-admin/firestore";

// ---------- Document types ----------

export interface UserDoc {
  email: string;
  passwordHash: string;
  displayName: string;
  role: "host" | "admin";
  emailVerified: boolean;
  createdAt: Timestamp;
}

export interface VerificationTokenDoc {
  code: string;
  expiresAt: Timestamp;
  createdAt: Timestamp;
}

export interface PasswordResetTokenDoc {
  code: string;
  expiresAt: Timestamp;
  createdAt: Timestamp;
}

export interface QuestionDoc {
  ownerId: string | null;
  category: string | null;
  language: string;
  text: string;
  choices: string[];
  correctIndex: number;
  createdAt: Timestamp;
}

export interface GameDoc {
  hostId: string;
  joinCode: string;
  status: "lobby" | "playing" | "finished" | "cancelled";
  language: string;
  numQuestions: number;
  currentQuestionIndex: number;
  createdAt: Timestamp;
}

export interface GameQuestionDoc {
  questionId: string;
  position: number;
  startedAt: Timestamp | null;
}

export interface TeamDoc {
  name: string;
  photoUrl: string | null;
  socketId: string | null;
  createdAt: Timestamp;
}

export interface AnswerDoc {
  gameQuestionId: string;
  teamId: string;
  chosenIndex: number | null;
  answeredAt: Timestamp;
  score: number;
}

export interface UniqueEmailDoc {
  userId: string;
}

export interface UniqueJoinCodeDoc {
  gameId: string;
}

export interface TeamRegistrationDoc {
  teamName: string;
  email: string;
  joinCode: string;
  code: string;
  codeExpiresAt: Timestamp;
  verified: boolean;
  createdAt: Timestamp;
}

// ---------- Collection helpers ----------

export const usersCol = () =>
  db.collection("users") as FirebaseFirestore.CollectionReference<UserDoc>;

export const questionsCol = () =>
  db.collection("questions") as FirebaseFirestore.CollectionReference<QuestionDoc>;

export const gamesCol = () =>
  db.collection("games") as FirebaseFirestore.CollectionReference<GameDoc>;

export const gameQuestionsCol = (gameId: string) =>
  db.collection(`games/${gameId}/gameQuestions`) as FirebaseFirestore.CollectionReference<GameQuestionDoc>;

export const teamsCol = (gameId: string) =>
  db.collection(`games/${gameId}/teams`) as FirebaseFirestore.CollectionReference<TeamDoc>;

export const answersCol = (gameId: string) =>
  db.collection(`games/${gameId}/answers`) as FirebaseFirestore.CollectionReference<AnswerDoc>;

export const uniqueEmailsCol = () =>
  db.collection("uniqueEmails") as FirebaseFirestore.CollectionReference<UniqueEmailDoc>;

export const uniqueJoinCodesCol = () =>
  db.collection("uniqueJoinCodes") as FirebaseFirestore.CollectionReference<UniqueJoinCodeDoc>;

export const teamRegistrationsCol = () =>
  db.collection("teamRegistrations") as FirebaseFirestore.CollectionReference<TeamRegistrationDoc>;

export const verificationTokensCol = (userId: string) =>
  db.collection(`users/${userId}/verificationTokens`) as FirebaseFirestore.CollectionReference<VerificationTokenDoc>;

export const passwordResetTokensCol = (userId: string) =>
  db.collection(`users/${userId}/passwordResetTokens`) as FirebaseFirestore.CollectionReference<PasswordResetTokenDoc>;
