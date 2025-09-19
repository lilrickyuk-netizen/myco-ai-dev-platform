import { SQLDatabase } from "encore.dev/storage/sqldb";

export default new SQLDatabase("myco_ai_platform", {
  migrations: "./migrations",
});