const socket = io();

let currentLocation = null;

const INTERVAL_MS = 3000;

const sendLocation = () => {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
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
};

sendLocation();
const locationInterval = setInterval(sendLocation, INTERVAL_MS);

window.addEventListener("beforeunload", () => {
  clearInterval(locationInterval);
});

const map = L.map("map").setView([0, 0], 16);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "Realtime Location Tracker",
}).addTo(map);

const markers = {};
const offsets = {};
const lastSeen = {};
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

const buildPopupHtml = (data) => {
  const timeStr = lastSeen[data.id]
    ? new Date(lastSeen[data.id]).toLocaleTimeString()
    : "—";
  const roleBadge =
    data.role === "leader"
      ? `<span style="background:#007bff;color:white;font-size:0.75em;border-radius:3px;padding:1px 5px;margin-left:4px;font-weight:600;vertical-align:middle">Leader</span>`
      : "";
  const phoneRow = data.phone
    ? `<div style="margin-top:4px"><span style="color:#888;font-size:0.82em">Phone: </span><a href="tel:${data.phone}" style="color:#007bff;text-decoration:none">${data.phone}</a></div>`
    : "";
  return `<div style="min-width:130px;line-height:1.5">
    <strong>${data.name}</strong>${roleBadge}
    ${phoneRow}
    <div style="margin-top:4px;color:#888;font-size:0.8em">Updated: ${timeStr}</div>
  </div>`;
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

  lastSeen[id] = Date.now();

  if (markers[id]) {
    markers[id].setLatLng([displayLat, displayLng]);
    markers[id].setPopupContent(buildPopupHtml(data));
  } else {
    markers[id] = L.marker([displayLat, displayLng])
      .bindPopup(buildPopupHtml(data))
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
    delete lastSeen[id];
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
