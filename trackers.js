import { fetchOnlinePlayers } from './utils.js';
import fs from 'fs/promises';
import path from 'path';

const TRACKERS_FILE = path.resolve('./data/trackers.json');
let trackedPlayers = new Map(); // Map<uuid, { username: string, lastStatus: { online: boolean, world: string }, trackedBy: Set<string> }>

export async function initTrackers() {
    try {
        const data = await fs.readFile(TRACKERS_FILE, 'utf-8');
        const raw = JSON.parse(data);
        
        // Convert loaded data to the new Map structure (UUID as key)
        trackedPlayers = new Map(
            Object.entries(raw).map(([uuid, entry]) => [
                uuid,
                {
                    username: entry.username, // Store username for display
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
            Array.from(trackedPlayers.entries()).map(([uuid, data]) => [
                uuid, // Use UUID as the key in the JSON file
                {
                    username: data.username, // Store username in the JSON file
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
        // Create a map keyed by UUID for efficient lookup
        const onlineMap = new Map(onlinePlayers.map(p => [p.uuid, p]));
        
        // Iterate through tracked players (which are now keyed by UUID)
        for (const [uuid, data] of trackedPlayers.entries()) {
            const current = onlineMap.get(uuid); // Look up by UUID
            const newStatus = {
                online: !!current,
                world: current?.world || null
            };
            
            // Use data.username for notifications
            if (newStatus.online !== data.lastStatus.online) {
                notifyStatusChange(client, data.trackedBy, data.username, newStatus);
            } else if (newStatus.online && newStatus.world !== data.lastStatus.world) {
                notifyWorldChange(client, data.trackedBy, data.username, newStatus.world);
            }
            
            // Update the lastStatus and also the username in case it changed
            data.lastStatus = newStatus;
            if (current && data.username !== current.name) {
                data.username = current.name; // Update username if it changed
                saveTrackers(); // Save if username changed
            }
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
