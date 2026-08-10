const lat = 12.97;
const lng = 77.59;
const k_lat = 19.7565;
const k_lng = 79.1667;

const distance = 6371 * Math.acos(
    Math.min(1, Math.max(-1,
        Math.cos(lat * Math.PI / 180) * Math.cos(k_lat * Math.PI / 180) * Math.cos((k_lng - lng) * Math.PI / 180)
        + Math.sin(lat * Math.PI / 180) * Math.sin(k_lat * Math.PI / 180)
    ))
);
console.log(distance);
console.log(distance <= "0");
