import { SQLDatabase } from "encore.dev/storage/sqldb";

export const filesDB = new SQLDatabase("files", {
  migrations: "./migrations",
});
