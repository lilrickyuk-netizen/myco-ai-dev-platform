import { SQLDatabase } from "encore.dev/storage/sqldb";

export const agentsDB = new SQLDatabase("agents", {
  migrations: "./migrations",
});