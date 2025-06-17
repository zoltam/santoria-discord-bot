import { removeTracker, getTrackedPlayers } from '../trackers.js';

export const data = {
    name: 'untrack',
    description: 'Stop tracking a player',
    options: [{
        name: 'player',
        type: 3,
        description: 'Minecraft username to stop tracking',
        required: true,
        autocomplete: true
    }]
};

export async function execute(interaction) {
    const playerName = interaction.options.getString('player');
    const userId = interaction.user.id;

    const trackedPlayers = getTrackedPlayers();
    let playerUuidToUntrack = null;

    // Find the UUID for the given player name among currently tracked players
    for (const [uuid, data] of trackedPlayers.entries()) {
        if (data.username.toLowerCase() === playerName.toLowerCase() && data.trackedBy.has(userId)) {
            playerUuidToUntrack = uuid;
            break;
        }
    }

    let success = false;
    if (playerUuidToUntrack) {
        success = removeTracker(playerUuidToUntrack, userId);
    }
    
    await interaction.reply({
        content: success ? 
            `🚫 No longer tracking ${playerName}` : 
            `❌ You weren't tracking ${playerName}`,
        ephemeral: true
    });
}

export async function autocomplete(interaction) {
    try {
        const focusedValue = interaction.options.getFocused() || '';
        const userId = interaction.user.id;
        
        const trackedPlayers = getTrackedPlayers();
        const tracked = [];
        
        for (const [uuid, data] of trackedPlayers) { // Iterate by UUID and data
            if (data?.trackedBy?.has(userId) && data.username) { // Use data.username
                tracked.push(data.username);
            }
        }

        const searchTerm = focusedValue.toLowerCase();
        const filtered = tracked
            .filter(name => name && typeof name === 'string' && name.toLowerCase().startsWith(searchTerm))
            .slice(0, 25);

        await interaction.respond(
            filtered.map(name => ({ name, value: name }))
        );
    } catch (error) {
        console.error('Autocomplete error:', error);
        await interaction.respond([]);
    }
}
