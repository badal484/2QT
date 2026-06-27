import axios from 'axios';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

export const getDistanceKm = async (
    originLat: number, originLng: number, 
    destLat: number, destLng: number
): Promise<number | null> => {
    if (!GOOGLE_MAPS_API_KEY) {
        console.warn('Google Maps API Key is missing. Returning null for distance.');
        return null;
    }

    try {
        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originLat},${originLng}&destinations=${destLat},${destLng}&key=${GOOGLE_MAPS_API_KEY}`;
        const response = await axios.get(url);
        
        if (response.data.status === 'OK' && response.data.rows[0].elements[0].status === 'OK') {
            const distanceMeters = response.data.rows[0].elements[0].distance.value;
            return distanceMeters / 1000;
        }
        return null;
    } catch (err) {
        console.error('Google Maps Distance Matrix Error:', err);
        return null;
    }
};

export const reverseGeocode = async (lat: number, lng: number): Promise<string | null> => {
    if (!GOOGLE_MAPS_API_KEY) {
        return null;
    }

    try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`;
        const response = await axios.get(url);
        
        if (response.data.status === 'OK' && response.data.results.length > 0) {
            return response.data.results[0].formatted_address;
        }
        return null;
    } catch (err) {
        console.error('Google Maps Reverse Geocode Error:', err);
        return null;
    }
};
