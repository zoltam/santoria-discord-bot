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
    
    addTracker(
        playerName.toLowerCase(),
        userId,
        !!player,
        player?.world || null
    );
    
    await interaction.reply({
        content: `Now tracking ${playerName}. You'll get notifications!`,
        ephemeral: true
    });
}