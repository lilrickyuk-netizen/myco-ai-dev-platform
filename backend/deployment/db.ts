import { SQLDatabase } from "encore.dev/storage/sqldb";

export const deploymentDB = new SQLDatabase("deployment", {
  migrations: "./migrations",
});