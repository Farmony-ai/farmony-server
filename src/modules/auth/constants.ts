export const jwtConstants = {
  secret: process.env.JWT_SECRET || 'fallback_secret',
};

export const TOKEN_CONFIG = {
  ACCESS_TOKEN_EXPIRY: '15m',
  ACCESS_TOKEN_EXPIRY_SECONDS: 900,
  REFRESH_TOKEN_EXPIRY_DAYS: 30,
  REFRESH_TOKEN_EXPIRY_SECONDS: 30 * 24 * 60 * 60, // 30 days in seconds
  AUTO_REFRESH_THRESHOLD_SECONDS: 300, // Refresh if < 5min left
  MAX_REFRESH_TOKEN_FAMILY_SIZE: 10, // Prevent infinite chains
};