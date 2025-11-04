/**
 * GeoJSON types and validators for geographic coordinates
 */

export type GeoPoint = {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
};

/**
 * Reusable Mongoose schema definition for a GeoJSON Point
 */
export const pointDefinition = {
    type: { type: String, enum: ['Point'], required: true, default: 'Point' },
    coordinates: {
        type: [Number],
        required: true,
        validate: {
            validator: (v: number[]) => Array.isArray(v) && v.length === 2 && v[0] >= -180 && v[0] <= 180 && v[1] >= -90 && v[1] <= 90,
            message: 'coordinates must be [lng, lat] with lng in [-180,180] and lat in [-90,90]',
        },
    },
} as const;

/**
 * Validate longitude is within valid range [-180, 180]
 */
export const isValidLng = (lng: number) => Number.isFinite(lng) && lng >= -180 && lng <= 180;

/**
 * Validate latitude is within valid range [-90, 90]
 */
export const isValidLat = (lat: number) => Number.isFinite(lat) && lat >= -90 && lat <= 90;

/**
 * Validate both longitude and latitude
 */
export const isValidLngLat = (lng: number, lat: number) => isValidLng(lng) && isValidLat(lat);

/**
 * Create a GeoJSON Point from coordinates
 * @param lng - Longitude [-180, 180]
 * @param lat - Latitude [-90, 90]
 * @returns GeoJSON Point object
 * @throws Error if coordinates are invalid
 */
export function makePoint(lng: number, lat: number): GeoPoint {
    if (!isValidLngLat(lng, lat)) {
        throw new Error('Invalid coordinates: require [lng, lat] with lng in [-180,180], lat in [-90,90]');
    }
    return { type: 'Point', coordinates: [lng, lat] };
}
