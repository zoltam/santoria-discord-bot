import fetch from 'node-fetch';

let landsCache = [];
let lastFetch = 0;
const CACHE_DURATION = 5 * 60 * 1000;

export async function fetchLands() {
    if (Date.now() - lastFetch < CACHE_DURATION && landsCache.length > 0) {
        return landsCache;
    }

    try {
        const response = await fetch('https://atlas-map.santoria.net/tiles/minecraft_overworld/markers.json');
        const data = await response.json();
        const landsLayer = data.find(layer => layer.name === 'Lands');

        if (!landsLayer || !landsLayer.markers) {
            console.error('No lands layer found');
            return [];
        }

        landsCache = landsLayer.markers
            .filter(marker => marker.type === 'polygon' && marker.tooltip)
            .map(marker => {
                let avgX = null;
                let avgZ = null;
                let playersCount = 0;
                let playersList = [];
                let nationName = 'None';
                let nationInfo = '';
            
                if (marker.points && marker.points[0] && marker.points[0].length > 0) {
                    const points = marker.points[0];
                    const total = points.reduce((acc, point) => {
                        acc.x += point.x;
                        acc.z += point.z;
                        return acc;
                    }, { x: 0, z: 0 });
            
                    avgX = Math.round(total.x / points.length);
                    avgZ = Math.round(total.z / points.length);
                }
            
                const tooltipText = marker.tooltip.replace(/<[^>]*>/g, ' ');
                const sections = tooltipText.split(/\s{2,}/);

                for (const section of sections) {
                    const playersMatch = section.match(/^Players \((\d+)\): (.*)$/s);
                    if (playersMatch) {
                        playersCount = parseInt(playersMatch[1]);
                        const playersStr = playersMatch[2];
                        playersList = playersStr.split(/,\s*/)
                            .map(p => p.trim())
                            .filter(p => p);
                    }

                    const nationMatch = section.match(/^This land belongs to nation (.*?):\s*(.*)$/s);
                    if (nationMatch) {
                        nationName = nationMatch[1];
                        nationInfo = nationMatch[2].replace(/\s+/g, ' ');
                    }
                }

                const nameMatch = marker.tooltip.match(/<span style="color: \{land_color\};">(.*?)<\/span>/);
                
                return {
                    name: nameMatch ? nameMatch[1] : '',
                    x: avgX,
                    z: avgZ,
                    playersCount,
                    playersList,
                    nationName,
                    nationInfo
                };
            });

        lastFetch = Date.now();
        return landsCache;
    } catch (error) {
        console.error('Error fetching lands:', error);
        return [];
    }
}

export async function fetchOnlinePlayers() {
    try {
        const response = await fetch('https://atlas-map.santoria.net/tiles/players.json');
        const data = await response.json();
        // The user confirmed that players.json contains UUIDs
        return (data.players || []).map(player => ({
            name: player.name,
            uuid: player.uuid,
            world: player.world // Keep world info if it's used elsewhere
        }));
    } catch (error) {
        console.error('Fetch players error:', error);
        return [];
    }
}

export function formatUuid(uuid) {
    if (!uuid || uuid.length !== 32) {
        return uuid; // Return as is if not a valid trimmed UUID
    }
    return `${uuid.substring(0, 8)}-${uuid.substring(8, 12)}-${uuid.substring(12, 16)}-${uuid.substring(16, 20)}-${uuid.substring(20, 32)}`;
}

export async function fetchPlayerUuid(username) {
    try {
        const response = await fetch(`https://api.mojang.com/users/profiles/minecraft/${username}`);
        if (response.ok) {
            const data = await response.json();
            if (data && data.id) {
                return data.id; // Returns the UUID
            }
        }
        return null; // Player not found or UUID not available
    } catch (error) {
        console.error(`Error fetching UUID for ${username}:`, error);
        return null;
    }
}
