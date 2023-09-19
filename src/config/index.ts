import { config } from "dotenv";
config({ path: `.env.${process.env.NODE_ENV || "development"}.local` });

export const CREDENTIALS = process.env.CREDENTIALS === "true";
export const {
  NODE_ENV,
  PORT,
  DB_HOST,
  DB_PORT,
  DB_USER,
  DB_PASSWORD,
  DB_DATABASE,
  SECRET_KEY,
  WEBSOCKET_ALGORITHM,
  WEBSOCKET_SECRET_KEY,
  WEBSOCKET_SECRET_IV,
  EXPO_ACCESS_TOKEN,
  S3_BUCKET_NAME,
  S3_BUCKET_REGION,
  S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY,
} = process.env;
