import { ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';

@ValidatorConstraint({ name: 'isValidCoordinates', async: false })
export class IsValidCoordinates implements ValidatorConstraintInterface {
    validate(coords: [number, number], args: ValidationArguments): boolean {
        if (!Array.isArray(coords) || coords.length !== 2) {
            return false;
        }

        const [lng, lat] = coords;

        if (typeof lng !== 'number' || typeof lat !== 'number') {
            return false;
        }

        // Longitude: -180 to 180
        // Latitude: -90 to 90
        return lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
    }

    defaultMessage(args: ValidationArguments): string {
        return 'Coordinates must be [longitude, latitude] with longitude between -180 and 180, latitude between -90 and 90';
    }
}
