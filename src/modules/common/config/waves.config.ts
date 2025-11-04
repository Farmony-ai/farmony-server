/**
 * Wave-based provider matching configuration
 * Centralized configuration for progressive radius expansion and notification timing
 */

export const WAVE_CONFIG = {
  // Radius increments for each wave (in meters)
  // Wave 1: 5km, Wave 2: 10km, Wave 3: 15km, Wave 4: 25km, Wave 5: 40km
  radiusIncrements: [5000, 10000, 15000, 25000, 40000],
  
  // Time to wait between waves (in minutes)
  waveDelayMinutes: 10,
  
  // Maximum number of waves to process before giving up
  maxWaves: 5,
  
  // Minimum number of providers to notify in each wave
  minProvidersPerWave: 1,
  
  // Hours until a service request expires
  expiryHours: 24,
} as const;

/**
 * Type-safe wave configuration
 */
export type WaveConfig = typeof WAVE_CONFIG;
