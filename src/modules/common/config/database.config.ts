// src/config/database.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  uriDev: process.env.MONGO_URI_DEV,
  uriProd: process.env.MONGO_URI_PROD,
}));
