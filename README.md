# CycloTrack

![2024-07-15](https://github.com/user-attachments/assets/51021220-d6c5-44fd-a08c-36061af891fe)

A real-time cycling group tracker. The ride leader manages the session while all riders see each other on a live map.

## Features

**For all riders**
- Live location updates every 3 seconds on an interactive map
- Colour-coded pin markers for each rider type
- Click any rider in the location list to fly the map to their position
- Tap a marker to see name, phone number, and last update time (popup stays open for 5 seconds)
- Distance to destination shown per rider in the location list (when destination is set)
- Toast notifications for ride events and announcements
- Stopped rider detection — marker turns red if a rider hasn't moved 10m in 15 seconds (only active during a ride)
- Trip history page — view all past rides with routes, notes, and analytics

**For the ride leader**
- Start / Stop Ride controls — stopped detection only activates after the ride begins
- Set a destination pin visible to all riders (persists for riders who join mid-ride)
- Drop waypoint pins at any map location (recorded in trip history when ride is active)
- Send announcements that appear as toasts for all riders
- Add notes during a ride (timestamped, saved to trip history)
- Post-ride notes modal — leave route advice for future leaders after stopping the ride

**Map legend (visible to all)**

| Marker | Meaning |
|---|---|
| 🟢 Green | Ride Leader |
| 🔵 Blue | Active Rider |
| 🔴 Red | Stopped Rider |
| 🟠 Orange | Waypoint |
| 🟣 Purple | Destination |

## Trip History

Visit `/history` (linked in the tracker header) to browse all recorded rides. Each entry shows:
- Date, leader, duration, and rider count
- Full route: AIT → waypoints → destination
- Timestamped notes from during the ride
- Post-ride leader advice for future groups

5 demo rides are pre-loaded, all originating from Army Institute of Technology, Pune.

## Tech Stack

- **Node.js + Express** — server and routing
- **Socket.IO** — real-time bidirectional communication
- **EJS** — server-side templating
- **JWT + cookie-parser** — session auth (8-hour tokens, httpOnly cookies)
- **Mongoose + MongoDB Atlas** — persistent trip history
- **Leaflet.js + MarkerCluster** — interactive map with clustered markers
- **OpenStreetMap** — map tiles

## Getting Started

1. Clone the repository:
    ```bash
    git clone https://github.com/wreckurring/Realtime-Location-Tracker.git
    cd Realtime-Location-Tracker
    ```

2. Install dependencies:
    ```bash
    npm install
    ```

3. Set environment variables (or let them default for local dev):

    | Variable | Description | Default |
    |---|---|---|
    | `JWT_SECRET` | Secret for signing JWT tokens | `dev-secret-change-in-production` |
    | `LEADER_PASSWORD` | Password to join as ride leader | `leader123` |
    | `MONGODB_URI` | MongoDB Atlas connection string | `mongodb://localhost/cyclotrack` |
    | `PORT` | Server port | `3000` |

4. Start the server:
    ```bash
    npm start
    ```

5. Open `http://localhost:3000` — you will be redirected to the join page.

## Joining a Session

- Enter your name and optionally a phone number
- To join as **Ride Leader**, check the toggle and enter the leader password
- Regular riders just enter their name and join

## Deployment

Deployed on [Render](https://render.com) as a single Web Service (backend + frontend in one).

- **Build command:** `npm install`
- **Start command:** `npm start`
- Set `JWT_SECRET`, `LEADER_PASSWORD`, and `MONGODB_URI` as environment variables in the Render dashboard

**Live demo:** [realtime-location-tracker-pehe.onrender.com](https://realtime-location-tracker-pehe.onrender.com) *(may take a few seconds to wake up on the free tier)*
