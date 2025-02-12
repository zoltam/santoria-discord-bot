import { fetchOnlinePlayers } from './utils.js';
import fs from 'fs/promises';
import path from 'path';

const TRACKERS_FILE = path.resolve('./trackers.json');
let trackedPlayers = new Map();

// Initialize trackers from file
export async function initTrackers() {
    try {
        const data = await fs.readFile(TRACKERS_FILE, 'utf-8');
        const raw = JSON.parse(data);
        
        // Inside initTrackers() when loading from JSON
trackedPlayers = new Map(
    Object.entries(raw).map(([username, entry]) => [
        username,
        {
            originalUsername: entry.originalUsername || username, // Fallback to map key
            lastStatus: entry.lastStatus,
            trackedBy: new Set(entry.trackedBy)
        }
    ])
);
        console.log(`Loaded ${trackedPlayers.size} trackers from file`);
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
        const toSave = Object.fromEntries(
            Array.from(trackedPlayers.entries()).map(([username, data]) => [
                username,
                {
                    lastStatus: data.lastStatus,
                    trackedBy: Array.from(data.trackedBy)
                }
            ])
        );
        await fs.writeFile(TRACKERS_FILE, JSON.stringify(toSave, null, 2));
    } catch (error) {
        console.error('Error saving trackers:', error);
    }
}

export function addTracker(username, userId, isOnline, world) {
    const key = username.toLowerCase();
    const data = trackedPlayers.get(key) || {
        originalUsername: username,
        lastStatus: { online: isOnline, world },
        trackedBy: new Set()
    };
    data.trackedBy.add(userId);
    trackedPlayers.set(key, data);
    saveTrackers();
}

// Add this if you want removal functionality
export function removeTracker(username, userId) {
    const key = username.toLowerCase();
    const data = trackedPlayers.get(key);
    
    if (!data) return false;
    
    const hadTracking = data.trackedBy.delete(userId);
    if (data.trackedBy.size === 0) {
        trackedPlayers.delete(key);
    }
    
    if (hadTracking) saveTrackers();
    return hadTracking;
}

export async function checkTrackers(client) {
    try {
        const onlinePlayers = await fetchOnlinePlayers();
        const onlineMap = new Map(onlinePlayers.map(p => [p.name.toLowerCase(), p]));
        
        for (const [username, data] of trackedPlayers.entries()) {
            const current = onlineMap.get(username);
            const newStatus = {
                online: !!current,
                world: current?.world || null
            };
            
            // Check status changes
            if (newStatus.online !== data.lastStatus.online) {
                notifyStatusChange(client, data.trackedBy, username, newStatus);
            } else if (newStatus.online && newStatus.world !== data.lastStatus.world) {
                notifyWorldChange(client, data.trackedBy, username, newStatus.world);
            }
            
            data.lastStatus = newStatus;
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