const polygon = [
  { "lat": 23.77026416023979, "lng": 84.72656250000001 },
  { "lat": 22.849601761797313, "lng": 85.0396728515625 },
  { "lat": 22.85972558644609, "lng": 86.2646484375 },
  { "lat": 23.807962494353514, "lng": 85.946044921875 },
  { "lat": 24.25948538299899, "lng": 85.25390625000001 },
  { "lat": 24.27513468493838, "lng": 84.79385375976564 }
];

const point = { lat: 23.8309141, lng: 85.0984247 };

const isPointInPolygon = (point, polygon) => {
    let x = point.lng, y = point.lat, inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].lng, yi = polygon[i].lat;
        const xj = polygon[j].lng, yj = polygon[j].lat;
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi))
            inside = !inside;
    }
    return inside;
};

console.log("Is Keredari inside?", isPointInPolygon(point, polygon));

const point2 = { lat: 23.8657846, lng: 85.0931668 };
console.log("Is other Keredari inside?", isPointInPolygon(point2, polygon));

const point3 = { lat: 23.86105213, lng: 85.06290556 };
console.log("Is Tr Keredari inside?", isPointInPolygon(point3, polygon));

