const axios = require('axios');

/**
 * Geocode một địa chỉ text thành coordinates và thông tin chi tiết
 * @param {string} address - Địa chỉ cần geocode (có thể là locationName + address)
 * @returns {Object|null} - Object chứa coordinates và thông tin địa chỉ hoặc null nếu thất bại
 */
const geocodeAddress = async (address) => {
  try {
    if (!address || address.trim() === '') {
      console.warn('Empty address provided for geocoding');
      return null;
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('GOOGLE_MAPS_API_KEY not found in environment variables');
      return null;
    }

    const encodedAddress = encodeURIComponent(address.trim());
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`;

    console.log('Geocoding address:', address);

    const response = await axios.get(url);
    const data = response.data;

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const result = data.results[0];
      const { geometry, formatted_address, place_id } = result;

      return {
        type: 'Point',
        coordinates: [
          geometry.location.lng, // longitude first (GeoJSON standard)
          geometry.location.lat, // latitude second
        ],
        formattedAddress: formatted_address,
        placeId: place_id,
        mapZoomLevel: 15,
      };
    } else {
      console.warn('Geocoding failed:', data.status, data.error_message);
      return null;
    }
  } catch (error) {
    console.error('Error during geocoding:', error.message);
    return null;
  }
};

/**
 * Reverse geocode từ coordinates thành địa chỉ
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Object|null} - Object chứa địa chỉ hoặc null nếu thất bại
 */
const reverseGeocode = async (lat, lng) => {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('GOOGLE_MAPS_API_KEY not found in environment variables');
      return null;
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;

    console.log('Reverse geocoding coordinates:', lat, lng);

    const response = await axios.get(url);
    const data = response.data;

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const result = data.results[0];

      return {
        formattedAddress: result.formatted_address,
        placeId: result.place_id,
      };
    } else {
      console.warn(
        'Reverse geocoding failed:',
        data.status,
        data.error_message
      );
      return null;
    }
  } catch (error) {
    console.error('Error during reverse geocoding:', error.message);
    return null;
  }
};

/**
 * Validate coordinates
 * @param {Array} coordinates - [longitude, latitude]
 * @returns {boolean} - true nếu hợp lệ
 */
const validateCoordinates = (coordinates) => {
  if (!Array.isArray(coordinates) || coordinates.length !== 2) {
    return false;
  }

  const [lng, lat] = coordinates;

  return (
    typeof lng === 'number' &&
    typeof lat === 'number' &&
    lng >= -180 &&
    lng <= 180 &&
    lat >= -90 &&
    lat <= 90
  );
};

module.exports = {
  geocodeAddress,
  reverseGeocode,
  validateCoordinates,
};
