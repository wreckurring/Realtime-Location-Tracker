const socket = io();

let currentLocation = null;

const INTERVAL_MS = 3000;
const STOPPED_THRESHOLD_MS = 12000;

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
const positions = {};
const userDataMap = {};
const stoppedState = {};
const markerClusterGroup = L.markerClusterGroup();
map.addLayer(markerClusterGroup);

const makeIcon = (cssClass) =>
  L.divIcon({
    className: "",
    html: `<div class="${cssClass}"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });

const leaderIcon = makeIcon("leader-marker");
const memberIcon = makeIcon("member-marker");
const stoppedIcon = makeIcon("stopped-marker");
const waypointIcon = makeIcon("waypoint-marker");

const getActiveIcon = (role) =>
  role === "leader" ? leaderIcon : memberIcon;

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
      ? `<span style="background:#27ae60;color:white;font-size:0.75em;border-radius:3px;padding:1px 5px;margin-left:4px;font-weight:600;vertical-align:middle">Leader</span>`
      : "";
  const phoneRow = data.phone
    ? `<div style="margin-top:4px"><span style="color:#888;font-size:0.82em">Phone: </span><a href="tel:${data.phone}" style="color:#007bff;text-decoration:none">${data.phone}</a></div>`
    : "";
  const stoppedRow = stoppedState[data.id]
    ? `<div style="margin-top:4px;color:#e74c3c;font-size:0.82em;font-weight:600">⚠ Not moving</div>`
    : "";
  return `<div style="min-width:130px;line-height:1.5">
    <strong>${data.name}</strong>${roleBadge}
    ${phoneRow}
    ${stoppedRow}
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
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const updateLocationList = (id, name, latitude, longitude, isStopped = false) => {
  const locationList = document.getElementById("location-list");
  let item = document.getElementById(`location-${id}`);
  if (!item) {
    item = document.createElement("li");
    item.id = `location-${id}`;
    locationList.appendChild(item);
  }

  item.textContent = "";

  const nameEl = document.createElement("strong");
  nameEl.textContent = name;
  item.appendChild(nameEl);
  item.appendChild(
    document.createTextNode(`: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`)
  );

  if (isStopped) {
    const tag = document.createElement("span");
    tag.className = "stopped-tag";
    tag.textContent = "STOPPED";
    item.appendChild(tag);
  }

  if (id !== "waypoint") {
    item.classList.add("clickable-rider");
    item.onclick = () => {
      if (!positions[id]) return;
      markerClusterGroup.zoomToShowLayer(markers[id], () => {
        markers[id].openPopup();
      });
    };
  } else {
    item.classList.remove("clickable-rider");
    item.onclick = null;
  }
};

socket.on("receive-location", (data) => {
  const { id, name, role, latitude, longitude } = data;
  const [offsetLat, offsetLng] = getOffset(id);
  const displayLat = latitude + offsetLat;
  const displayLng = longitude + offsetLng;

  lastSeen[id] = Date.now();
  positions[id] = { lat: latitude, lng: longitude };
  userDataMap[id] = data;

  if (markers[id]) {
    markers[id].setLatLng([displayLat, displayLng]);
    if (stoppedState[id]) {
      stoppedState[id] = false;
      markers[id].setIcon(getActiveIcon(role));
    }
    markers[id].setPopupContent(buildPopupHtml(data));
  } else {
    markers[id] = L.marker([displayLat, displayLng], { icon: getActiveIcon(role) })
      .bindPopup(buildPopupHtml(data))
      .addTo(markerClusterGroup);
    if (id === socket.id) {
      map.setView([latitude, longitude]);
    }
  }
  updateLocationList(id, name || id, latitude, longitude, false);
});

socket.on("user-disconnected", (id) => {
  if (markers[id]) {
    markerClusterGroup.removeLayer(markers[id]);
    delete markers[id];
    delete offsets[id];
    delete lastSeen[id];
    delete positions[id];
    delete userDataMap[id];
    delete stoppedState[id];
  }
  const item = document.getElementById(`location-${id}`);
  if (item) item.remove();
});

// Stopped detection — check every 5s
setInterval(() => {
  const now = Date.now();
  Object.keys(lastSeen).forEach((id) => {
    if (!markers[id] || stoppedState[id]) return;
    if (now - lastSeen[id] > STOPPED_THRESHOLD_MS) {
      stoppedState[id] = true;
      markers[id].setIcon(stoppedIcon);
      if (userDataMap[id]) {
        const { name, latitude, longitude } = userDataMap[id];
        updateLocationList(id, name, latitude, longitude, true);
        markers[id].setPopupContent(buildPopupHtml(userDataMap[id]));
      }
    }
  });
}, 5000);

// Announcements
const showToast = (message) => {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add("toast-show"), 10);
  setTimeout(() => {
    toast.classList.remove("toast-show");
    setTimeout(() => toast.remove(), 400);
  }, 5000);
};

socket.on("receive-announcement", ({ message, from }) => {
  showToast(`📢 ${from}: ${message}`);
});

if (currentUser.role === "leader") {
  const announcementBtn = document.getElementById("announcement-btn");
  const announcementInput = document.getElementById("announcement-input");

  announcementBtn.addEventListener("click", () => {
    const message = announcementInput.value.trim();
    if (!message) return;
    socket.emit("send-announcement", { message });
    announcementInput.value = "";
  });

  announcementInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") announcementBtn.click();
  });

  // Waypoint placement
  let manualMarker = null;
  map.on("click", (e) => {
    const { lat, lng } = e.latlng;
    const userConfirmed = window.confirm(
      `Add a waypoint at ${lat.toFixed(5)}, ${lng.toFixed(5)}?`
    );
    if (userConfirmed) {
      if (manualMarker) map.removeLayer(manualMarker);
      manualMarker = L.marker([lat, lng], { icon: waypointIcon })
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
      updateLocationList("waypoint", "Waypoint", lat, lng, false);
    }
  });
}
