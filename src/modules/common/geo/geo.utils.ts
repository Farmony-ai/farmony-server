/**
 * Geographic utility functions for distance calculations and unit conversions
 */

/**
 * Convert meters to kilometers
 * @param meters - Distance in meters
 * @returns Distance in kilometers
 */
export const metersToKm = (meters: number): number => {
    return meters / 1000;
};

/**
 * Convert kilometers to meters
 * @param km - Distance in kilometers
 * @returns Distance in meters
 */
export const kmToMeters = (km: number): number => {
    return km * 1000;
};

/**
 * Round distance to nearest integer meter
 * @param meters - Distance in meters
 * @returns Rounded distance in meters
 */
export const roundDistance = (meters: number): number => {
    return Math.round(meters);
};

/**
 * Calculate the Haversine distance between two geographic coordinates
 * @param lat1 - Latitude of first point
 * @param lon1 - Longitude of first point
 * @param lat2 - Latitude of second point
 * @param lon2 - Longitude of second point
 * @returns Distance in kilometers
 */
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance;
};

/**
 * Convert degrees to radians
 */
const toRadians = (degrees: number): number => {
    return degrees * (Math.PI / 180);
};
