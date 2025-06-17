import { fetchOnlinePlayers, formatUuid, fetchPlayerReputation, fetchLands, getReputationTitleAndColor } from './utils.js';
import fs from 'fs/promises';
import path from 'path';

const TRACKERS_FILE = path.resolve('./data/trackers.json');
const LOW_REP_THRESHOLD = 30; // Define what "low rep" means

let trackedPlayers = new Map(); // Map<uuid, { username: string, lastStatus: { online: boolean, world: string }, trackedBy: Set<string> }>
let lowRepTrackingUsers = new Set(); // New setting for low rep tracking, stores user IDs
let lowRepPlayersLastStatus = new Map(); // Map<uuid, { username: string, online: boolean, reputation: number, land: string, nation: string }>

export async function initTrackers() {
    try {
        const data = await fs.readFile(TRACKERS_FILE, 'utf-8');
        const raw = JSON.parse(data);
        
        // Convert loaded data to the new Map structure (UUID as key)
        // Handle old format where trackedPlayers was the root object
        const loadedTrackedPlayers = raw.trackedPlayers || raw; 
        trackedPlayers = new Map(
            Object.entries(loadedTrackedPlayers).map(([uuid, entry]) => [
                formatUuid(uuid), // Ensure UUID is consistently formatted when loading
                {
                    username: entry.username, // Store username for display
                    lastStatus: entry.lastStatus,
                    trackedBy: new Set(entry.trackedBy)
                }
            ])
        );
        lowRepTrackingUsers = new Set(raw.lowRepTrackingUsers || []); // Load the setting
        lowRepPlayersLastStatus = new Map(
            Object.entries(raw.lowRepPlayersLastStatus || {}).map(([uuid, entry]) => [
                formatUuid(uuid),
                entry
            ])
        );
        console.log(`Loaded ${trackedPlayers.size} trackers from file`);
        console.log(`Low rep tracking is enabled for ${lowRepTrackingUsers.size} users.`);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('No trackers file found, starting fresh');
        } else {
            console.error('Error loading trackers:', error);
        }
    }
}

async function saveTrackers() {
    try {
        const toSave = {
            trackedPlayers: Object.fromEntries(
                Array.from(trackedPlayers.entries()).map(([uuid, data]) => [
                    uuid, // Use UUID as the key in the JSON file
                    {
                        username: data.username, // Store username in the JSON file
                        lastStatus: data.lastStatus,
                        trackedBy: Array.from(data.trackedBy)
                    }
                ])
            ),
            lowRepTrackingUsers: Array.from(lowRepTrackingUsers), // Save the setting
            lowRepPlayersLastStatus: Object.fromEntries(Array.from(lowRepPlayersLastStatus.entries()))
        };
        await fs.writeFile(TRACKERS_FILE, JSON.stringify(toSave, null, 2));
    } catch (error) {
        console.error('Error saving trackers:', error);
    }
}

export function getLowRepTrackingStatus(userId) {
    return lowRepTrackingUsers.has(userId);
}

export function toggleLowRepTracking(userId) {
    const isEnabled = lowRepTrackingUsers.has(userId);
    if (isEnabled) {
        lowRepTrackingUsers.delete(userId);
    } else {
        lowRepTrackingUsers.add(userId);
    }
    saveTrackers();
    return !isEnabled;
}

export function addTracker(uuid, username, userId, isOnline, world) {
    const data = trackedPlayers.get(uuid) || {
        username: username, // Store the current username
        lastStatus: { online: isOnline, world },
        trackedBy: new Set()
    };
    data.trackedBy.add(userId);
    trackedPlayers.set(uuid, data); // Use UUID as the key
    saveTrackers();
}

export function removeTracker(uuid, userId) {
    const data = trackedPlayers.get(uuid); // Use UUID as the key
    
    if (!data) return false;
    
    const hadTracking = data.trackedBy.delete(userId);
    if (data.trackedBy.size === 0) {
        trackedPlayers.delete(uuid); // Use UUID as the key
    }
    
    if (hadTracking) saveTrackers();
    return hadTracking;
}

export async function checkTrackers(client) {
    try {
        const onlinePlayers = await fetchOnlinePlayers();
        const onlineMap = new Map(onlinePlayers.map(p => [p.uuid, p]));
        const lands = await fetchLands();
        const playerLandMap = new Map();
        for (const land of lands) {
            for (const playerName of land.playersList) {
                playerLandMap.set(playerName.toLowerCase(), {
                    landName: land.name,
                    nationName: land.nationName,
                });
            }
        }
        
        // Handle explicitly tracked players
        for (const [uuid, data] of trackedPlayers.entries()) {
            const current = onlineMap.get(uuid);
            const newStatus = {
                online: !!current,
                world: current?.world || null
            };
            
            if (newStatus.online !== data.lastStatus.online) {
                notifyStatusChange(client, data.trackedBy, data.username, newStatus);
            } else if (newStatus.online && newStatus.world !== data.lastStatus.world) {
                notifyWorldChange(client, data.trackedBy, data.username, newStatus.world);
            }
            
            data.lastStatus = newStatus;
            if (current && data.username !== current.name) {
                data.username = current.name;
                saveTrackers();
            }
        }

        // Handle low reputation player tracking
        if (lowRepTrackingUsers.size > 0) {
            const currentLowRepOnlinePlayers = new Map();
            for (const player of onlinePlayers) {
                const reputation = await fetchPlayerReputation(player.uuid);
                if (reputation !== null && reputation < LOW_REP_THRESHOLD) {
                    const playerLandInfo = playerLandMap.get(player.name.toLowerCase());
                    currentLowRepOnlinePlayers.set(player.uuid, {
                        username: player.name,
                        online: true,
                        reputation: reputation,
                        land: playerLandInfo ? playerLandInfo.landName : 'N/A',
                        nation: playerLandInfo && playerLandInfo.nationName !== 'None' ? playerLandInfo.nationName : 'N/A'
                    });
                }
            }

            // Check for new low rep players coming online
            for (const [uuid, currentData] of currentLowRepOnlinePlayers.entries()) {
                const lastData = lowRepPlayersLastStatus.get(uuid);
                if (!lastData || !lastData.online) {
                    // Player just came online or was previously offline
                    notifyLowRepPlayerOnline(client, lowRepTrackingUsers, currentData);
                }
            }

            // Update lowRepPlayersLastStatus
            lowRepPlayersLastStatus = currentLowRepOnlinePlayers;
            saveTrackers(); // Save the updated low rep player status
        }
    } catch (error) {
        console.error('Tracker check error:', error);
    }
}

function notifyStatusChange(client, users, username, status) {
    const message = status.online 
        ? `🎮 ${username} came online in ${getWorldName(status.world)}!`
        : `🚪 ${username} went offline!`;
    sendNotifications(client, users, message);
}

function notifyLowRepPlayerOnline(client, users, playerInfo) {
    const { title, color } = getReputationTitleAndColor(playerInfo.reputation);
    const message = `🚨 Low Rep Player Online! 🚨\n` +
                    `**Player:** ${playerInfo.username}\n` +
                    `**Reputation:** ${color} ${title} (${playerInfo.reputation} points)\n` +
                    `**Land:** 🏡 ${playerInfo.land}\n` +
                    `**Nation:** 👑 ${playerInfo.nation}`;
    sendNotifications(client, users, message);
}

function notifyWorldChange(client, users, username, world) {
    const message = `🌍 ${username} moved to ${getWorldName(world)}!`;
    sendNotifications(client, users, message);
}

function sendNotifications(client, userIds, message) {
    userIds.forEach(id => {
        client.users.fetch(id)
            .then(user => user.send(message))
            .catch(() => null);
    });
}

export function getTrackedPlayers() {
    return trackedPlayers;
}

function getWorldName(world) {
    return world === 'minecraft_overworld' ? 'Atlas' :
           world === 'minecraft_world_spawn' ? 'Aether' : 'Unknown';
}
