import { metersToKm, kmToMeters, roundDistance, calculateDistance } from './geo.utils';

describe('GeoUtils', () => {
  describe('metersToKm', () => {
    it('should convert meters to kilometers', () => {
      expect(metersToKm(1000)).toBe(1);
      expect(metersToKm(5000)).toBe(5);
      expect(metersToKm(500)).toBe(0.5);
      expect(metersToKm(0)).toBe(0);
    });
  });

  describe('kmToMeters', () => {
    it('should convert kilometers to meters', () => {
      expect(kmToMeters(1)).toBe(1000);
      expect(kmToMeters(5)).toBe(5000);
      expect(kmToMeters(0.5)).toBe(500);
      expect(kmToMeters(0)).toBe(0);
    });
  });

  describe('roundDistance', () => {
    it('should round distance to nearest integer', () => {
      expect(roundDistance(1234.567)).toBe(1235);
      expect(roundDistance(1234.123)).toBe(1234);
      expect(roundDistance(1234.5)).toBe(1235);
      expect(roundDistance(1234)).toBe(1234);
    });
  });

  describe('calculateDistance', () => {
    it('should calculate distance between two coordinates', () => {
      // Distance between New York and Los Angeles (approx 3944 km)
      const nyLat = 40.7128;
      const nyLon = -74.0060;
      const laLat = 34.0522;
      const laLon = -118.2437;
      
      const distance = calculateDistance(nyLat, nyLon, laLat, laLon);
      expect(distance).toBeGreaterThan(3900);
      expect(distance).toBeLessThan(4000);
    });

    it('should return 0 for same coordinates', () => {
      const distance = calculateDistance(40.7128, -74.0060, 40.7128, -74.0060);
      expect(distance).toBe(0);
    });

    it('should calculate small distances accurately', () => {
      // Two points approximately 1km apart
      const lat1 = 12.9716;
      const lon1 = 77.5946;
      const lat2 = 12.9806;
      const lon2 = 77.5946;
      
      const distance = calculateDistance(lat1, lon1, lat2, lon2);
      expect(distance).toBeGreaterThan(0.9);
      expect(distance).toBeLessThan(1.1);
    });
  });
});
