import 'dotenv/config';
import { DataSource } from 'typeorm';

/**
 * Shared TypeORM data source for the CLI (migrations) and seeds.
 * The Nest app configures its own connection in AppModule from ConfigService;
 * both read the same env vars so they always target the same database.
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // Migration SQL is the source of truth for schema — never synchronize.
  synchronize: false,
  entities: [__dirname + '/../**/*.entity.{ts,js}'],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
});
