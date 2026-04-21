const socket = io();

let currentLocation = null;

if (navigator.geolocation) {
  navigator.geolocation.watchPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      currentLocation = { latitude, longitude };
      console.log(`Sending location: ${latitude}, ${longitude}`);
      socket.emit("send-location", { latitude, longitude });
    },
    (error) => {
      console.log(error);
    },
    {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0,
    }
  );
}

const map = L.map("map").setView([0, 0], 16);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "Realtime Location Tracker by Kshitiz",
}).addTo(map);

const markers = {};
const offsets = {};
const markerClusterGroup = L.markerClusterGroup();
map.addLayer(markerClusterGroup);

const getOffset = (id) => {
  if (!offsets[id]) {
    const range = 0.00001;
    offsets[id] = [
      (Math.random() - 0.5) * range,
      (Math.random() - 0.5) * range,
    ];
  }
  return offsets[id];
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c;
  return distance;
};

const updateLocationList = (id, latitude, longitude, distance = null) => {
  const locationList = document.getElementById("location-list");
  let locationItem = document.getElementById(`location-${id}`);
  if (!locationItem) {
    locationItem = document.createElement("li");
    locationItem.id = `location-${id}`;
    locationList.appendChild(locationItem);
  }
  locationItem.textContent = `ID: ${id}, Latitude: ${latitude}, Longitude: ${longitude}${
    distance !== null ? `, Distance: ${distance.toFixed(2)} meters` : ""
  }`;
};

socket.on("receive-location", (data) => {
  const { id, latitude, longitude } = data;
  console.log(`Received location for ${id}: ${latitude}, ${longitude}`);
  const [offsetLat, offsetLng] = getOffset(id);
  const displayLat = latitude + offsetLat;
  const displayLng = longitude + offsetLng;
  if (markers[id]) {
    markers[id].setLatLng([displayLat, displayLng]);
  } else {
    markers[id] = L.marker([displayLat, displayLng]).addTo(markerClusterGroup);
    if (id === socket.id) {
      map.setView([latitude, longitude]);
    }
  }
  updateLocationList(id, latitude, longitude);
});

socket.on("user-disconnected", (id) => {
  console.log(`User disconnected: ${id}`);
  if (markers[id]) {
    markerClusterGroup.removeLayer(markers[id]);
    delete markers[id];
    delete offsets[id];
  }
  const locationItem = document.getElementById(`location-${id}`);
  if (locationItem) {
    locationItem.remove();
  }
});

let manualMarker = null;

map.on("click", (e) => {
  const { lat, lng } = e.latlng;
  const userConfirmed = window.confirm(
    `Do you want to add a marker at Latitude: ${lat}, Longitude: ${lng}?`
  );
  if (userConfirmed) {
    if (manualMarker) {
      map.removeLayer(manualMarker);
    }
    manualMarker = L.marker([lat, lng]).addTo(map);
    const distance = currentLocation
      ? calculateDistance(
          currentLocation.latitude,
          currentLocation.longitude,
          lat,
          lng
        )
      : null;
    updateLocationList("manual", lat, lng, distance);
  }
});
