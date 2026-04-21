const socket = io();

let currentLocation = null;

const INTERVAL_MS = 3000;
const STOPPED_THRESHOLD_MS = 12000;

let rideStarted = false;

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
const popupOpenedAt = {};
const markerClusterGroup = L.markerClusterGroup();
map.addLayer(markerClusterGroup);

map.on("popupopen", (e) => {
  Object.keys(markers).forEach((id) => {
    if (markers[id].getPopup() === e.popup) {
      popupOpenedAt[id] = Date.now();
    }
  });
});

map.on("popupclose", (e) => {
  Object.keys(markers).forEach((id) => {
    if (markers[id].getPopup() === e.popup) {
      delete popupOpenedAt[id];
    }
  });
});

const makePinIcon = (color) =>
  L.divIcon({
    className: "",
    html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
      <path d="M12 0C5.4 0 0 5.4 0 12c0 7.2 12 24 12 24S24 19.2 24 12C24 5.4 18.6 0 12 0z"
        fill="${color}" stroke="rgba(0,0,0,0.25)" stroke-width="1"/>
      <circle cx="12" cy="12" r="5" fill="white" opacity="0.75"/>
    </svg>`,
    iconSize: [24, 36],
    iconAnchor: [12, 36],
    popupAnchor: [0, -38],
  });

const leaderIcon      = makePinIcon("#27ae60");
const memberIcon      = makePinIcon("#2980b9");
const stoppedIcon     = makePinIcon("#e74c3c");
const waypointIcon    = makePinIcon("#e67e22");
const destinationIcon = makePinIcon("#8e44ad");

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

  const POPUP_LOCK_MS = 5000;
  const popupLocked = popupOpenedAt[id] && Date.now() - popupOpenedAt[id] < POPUP_LOCK_MS;

  if (markers[id]) {
    markers[id].setLatLng([displayLat, displayLng]);
    if (stoppedState[id]) {
      stoppedState[id] = false;
      markers[id].setIcon(getActiveIcon(role));
    }
    if (!popupLocked) {
      markers[id].setPopupContent(buildPopupHtml(data));
    }
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
    delete popupOpenedAt[id];
  }
  const item = document.getElementById(`location-${id}`);
  if (item) item.remove();
});

// Stopped detection — check every 5s, only when ride is active
setInterval(() => {
  if (!rideStarted) return;
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

const clearAllStoppedStates = () => {
  Object.keys(stoppedState).forEach((id) => {
    if (!stoppedState[id] || !markers[id]) return;
    stoppedState[id] = false;
    const role = userDataMap[id] ? userDataMap[id].role : "member";
    markers[id].setIcon(getActiveIcon(role));
    if (userDataMap[id]) {
      const { name, latitude, longitude } = userDataMap[id];
      updateLocationList(id, name, latitude, longitude, false);
      markers[id].setPopupContent(buildPopupHtml(userDataMap[id]));
    }
  });
};

const setRideStatus = (started) => {
  rideStarted = started;
  const dot = document.getElementById("ride-status-dot");
  const text = document.getElementById("ride-status-text");
  if (started) {
    dot.className = "status-dot active";
    text.textContent = "Ride in progress";
  } else {
    dot.className = "status-dot";
    text.textContent = "Ride not started";
  }
};

socket.on("ride-started", () => {
  setRideStatus(true);
  showToast("🚴 Ride started!");
});

socket.on("ride-stopped", () => {
  setRideStatus(false);
  clearAllStoppedStates();
  showToast("🏁 Ride ended.");
});

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
  const rideToggleBtn = document.getElementById("ride-toggle-btn");

  rideToggleBtn.addEventListener("click", () => {
    if (!rideStarted) {
      socket.emit("start-ride");
      rideToggleBtn.textContent = "Stop Ride";
      rideToggleBtn.className = "stop-btn";
    } else {
      socket.emit("stop-ride");
      rideToggleBtn.textContent = "Start Ride";
      rideToggleBtn.className = "start-btn";
    }
  });

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

  // Destination
  let destinationMarker = null;
  let destinationMode = false;

  const destinationBtn = document.getElementById("destination-btn");
  const clearDestinationBtn = document.getElementById("clear-destination-btn");
  const destinationHint = document.getElementById("destination-hint");

  destinationBtn.addEventListener("click", () => {
    destinationMode = !destinationMode;
    if (destinationMode) {
      destinationBtn.textContent = "✕ Cancel";
      destinationBtn.classList.add("active");
      destinationHint.style.display = "block";
      map.getContainer().style.cursor = "crosshair";
    } else {
      destinationBtn.textContent = "📍 Set Destination";
      destinationBtn.classList.remove("active");
      destinationHint.style.display = "none";
      map.getContainer().style.cursor = "";
    }
  });

  clearDestinationBtn.addEventListener("click", () => {
    socket.emit("clear-destination");
  });

  // Waypoint placement / destination placement
  let manualMarker = null;
  map.on("click", (e) => {
    const { lat, lng } = e.latlng;

    if (destinationMode) {
      const name = prompt("Destination name (optional):") || "Destination";
      socket.emit("set-destination", { lat, lng, name });
      destinationMode = false;
      destinationBtn.textContent = "📍 Set Destination";
      destinationBtn.classList.remove("active");
      destinationHint.style.display = "none";
      map.getContainer().style.cursor = "";
      return;
    }

    const userConfirmed = window.confirm(
      `Add a waypoint at ${lat.toFixed(5)}, ${lng.toFixed(5)}?`
    );
    if (userConfirmed) {
      if (manualMarker) map.removeLayer(manualMarker);
      manualMarker = L.marker([lat, lng], { icon: waypointIcon })
        .bindPopup("Waypoint")
        .addTo(map);
      updateLocationList("waypoint", "Waypoint", lat, lng, false);
    }
  });
}

// Destination events (all users)
let destinationMarkerGlobal = null;

socket.on("destination-set", ({ lat, lng, name }) => {
  if (destinationMarkerGlobal) map.removeLayer(destinationMarkerGlobal);
  destinationMarkerGlobal = L.marker([lat, lng], { icon: destinationIcon })
    .bindPopup(`<div style="min-width:100px"><strong>📍 ${name}</strong></div>`)
    .addTo(map);

  const item = document.getElementById("location-destination");
  if (!item) {
    const li = document.createElement("li");
    li.id = "location-destination";
    li.innerHTML = `<strong>📍 ${name}</strong>: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    document.getElementById("location-list").appendChild(li);
  } else {
    item.innerHTML = `<strong>📍 ${name}</strong>: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }

  if (currentUser.role === "leader") {
    document.getElementById("clear-destination-btn").style.display = "inline-block";
    document.getElementById("destination-btn").textContent = "📍 Set Destination";
    document.getElementById("destination-btn").classList.remove("active");
  }

  showToast(`📍 Destination set: ${name}`);
});

socket.on("destination-cleared", () => {
  if (destinationMarkerGlobal) {
    map.removeLayer(destinationMarkerGlobal);
    destinationMarkerGlobal = null;
  }
  const item = document.getElementById("location-destination");
  if (item) item.remove();
  if (currentUser.role === "leader") {
    document.getElementById("clear-destination-btn").style.display = "none";
  }
  showToast("📍 Destination cleared.");
});
