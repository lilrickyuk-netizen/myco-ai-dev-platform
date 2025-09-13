import { SQLDatabase } from "encore.dev/storage/sqldb";

export const DB = new SQLDatabase("deployment", {
  migrations: "./migrations",
});