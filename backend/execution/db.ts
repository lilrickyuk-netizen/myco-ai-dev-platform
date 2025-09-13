import { SQLDatabase } from "encore.dev/storage/sqldb";

export const executionDB = new SQLDatabase("execution", {
  migrations: "./migrations",
});