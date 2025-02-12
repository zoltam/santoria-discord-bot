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
            
                // Calculate coordinates
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
            
                // Extract information from tooltip
                const tooltipText = marker.tooltip.replace(/<[^>]*>/g, ' ');
                const sections = tooltipText.split(/\s{2,}/);

                for (const section of sections) {
                    // Players section
                    const playersMatch = section.match(/^Players \((\d+)\): (.*)$/s);
                    if (playersMatch) {
                        playersCount = parseInt(playersMatch[1]);
                        const playersStr = playersMatch[2];
                        playersList = playersStr.split(/,\s*/)
                            .map(p => p.trim())
                            .filter(p => p);
                    }

                    // Nation section
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
        return (await response.json()).players || [];
    } catch (error) {
        console.error('Fetch players error:', error);
        return [];
    }
}