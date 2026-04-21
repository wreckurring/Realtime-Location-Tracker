const socket = io();

let currentLocation = null;

if (navigator.geolocation) {
  navigator.geolocation.watchPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      currentLocation = { latitude, longitude };
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
  attribution: "Realtime Location Tracker",
}).addTo(map);

const markers = {};
const offsets = {};
const markerClusterGroup = L.markerClusterGroup();
map.addLayer(markerClusterGroup);

const redIcon = L.divIcon({
  className: "",
  html: '<div class="red-marker"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

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

  return R * c;
};

const updateLocationList = (id, name, latitude, longitude, distance = null) => {
  const locationList = document.getElementById("location-list");
  let locationItem = document.getElementById(`location-${id}`);
  if (!locationItem) {
    locationItem = document.createElement("li");
    locationItem.id = `location-${id}`;
    locationList.appendChild(locationItem);
  }
  locationItem.textContent = `${name}: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}${
    distance !== null ? ` | ${distance.toFixed(0)}m away` : ""
  }`;
};

socket.on("receive-location", (data) => {
  const { id, name, latitude, longitude } = data;
  const [offsetLat, offsetLng] = getOffset(id);
  const displayLat = latitude + offsetLat;
  const displayLng = longitude + offsetLng;

  if (markers[id]) {
    markers[id].setLatLng([displayLat, displayLng]);
  } else {
    markers[id] = L.marker([displayLat, displayLng])
      .bindPopup(name)
      .addTo(markerClusterGroup);
    if (id === socket.id) {
      map.setView([latitude, longitude]);
    }
  }
  updateLocationList(id, name || id, latitude, longitude);
});

socket.on("user-disconnected", (id) => {
  if (markers[id]) {
    markerClusterGroup.removeLayer(markers[id]);
    delete markers[id];
    delete offsets[id];
  }
  const locationItem = document.getElementById(`location-${id}`);
  if (locationItem) locationItem.remove();
});

if (currentUser.role === "leader") {
  let manualMarker = null;

  map.on("click", (e) => {
    const { lat, lng } = e.latlng;
    const userConfirmed = window.confirm(
      `Add a waypoint at ${lat.toFixed(5)}, ${lng.toFixed(5)}?`
    );
    if (userConfirmed) {
      if (manualMarker) map.removeLayer(manualMarker);
      manualMarker = L.marker([lat, lng], { icon: redIcon })
        .bindPopup("Waypoint")
        .addTo(map);
      const distance = currentLocation
        ? calculateDistance(
            currentLocation.latitude,
            currentLocation.longitude,
            lat,
            lng
          )
        : null;
      updateLocationList("waypoint", "Waypoint", lat, lng, distance);
    }
  });
}
