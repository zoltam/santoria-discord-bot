import { fetchOnlinePlayers } from '../utils.js';
import { addTracker } from '../trackers.js';

export const data = {
    name: 'track',
    description: 'Track a player',
    options: [{
        name: 'player',
        type: 3,
        description: 'Minecraft username',
        required: true
    }]
};

export async function execute(interaction) {
    const playerName = interaction.options.getString('player');
    const userId = interaction.user.id;
    const onlinePlayers = await fetchOnlinePlayers();
    const player = onlinePlayers.find(p => p.name.toLowerCase() === playerName.toLowerCase());
    
    if (!player) {
        await interaction.reply({
            content: `Could not find player ${playerName} online to get their UUID. Please try again when they are online.`,
            ephemeral: true
        });
        return;
    }

    addTracker(
        player.uuid, // Pass UUID
        playerName, // Pass original casing for username
        userId,
        !!player,
        player?.world || null
    );
    
    await interaction.reply({
        content: `Now tracking ${playerName}. You'll get notifications!`,
        ephemeral: true
    });
}
