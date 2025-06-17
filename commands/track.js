import { fetchOnlinePlayers, fetchPlayerUuid } from '../utils.js';
import { addTracker } from '../trackers.js';

export const data = {
    name: 'track',
    description: 'Track a player',
    options: [{
        name: 'player',
        type: 3, // STRING type
        description: 'Minecraft username',
        required: true,
        autocomplete: true // Enable autocomplete
    }]
};

export async function execute(interaction) {
    const playerName = interaction.options.getString('player');
    const userId = interaction.user.id;
    const onlinePlayers = await fetchOnlinePlayers();
    let playerUuid = null;
    let playerWorld = null;
    let isOnline = false;

    const onlinePlayer = onlinePlayers.find(p => p.name.toLowerCase() === playerName.toLowerCase());

    if (onlinePlayer) {
        playerUuid = onlinePlayer.uuid;
        playerWorld = onlinePlayer.world;
        isOnline = true;
    } else {
        // If not online, try to fetch UUID from Mojang API
        playerUuid = await fetchPlayerUuid(playerName);
    }
    
    if (!playerUuid) {
        await interaction.reply({
            content: `Could not find player ${playerName} to get their UUID. Please ensure the username is correct.`,
            ephemeral: true
        });
        return;
    }

    addTracker(
        playerUuid,
        playerName,
        userId,
        isOnline,
        playerWorld
    );
    
    await interaction.reply({
        content: `Now tracking ${playerName}. You'll get notifications!`,
        ephemeral: true
    });
}
