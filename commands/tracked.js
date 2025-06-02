import { getTrackedPlayers } from '../trackers.js';

export const data = {
    name: 'tracked',
    description: 'List all players you are currently tracking.'
};

export async function execute(interaction) {
    const userId = interaction.user.id;
    const trackedPlayers = getTrackedPlayers();
    const userTracked = [];

    for (const [_, data] of trackedPlayers.entries()) {
        if (data.trackedBy.has(userId) && data.originalUsername) {
            userTracked.push(data.originalUsername);
        }
    }

    if (userTracked.length === 0) {
        await interaction.reply({
            content: 'You are not currently tracking any players.',
            ephemeral: true
        });
    } else {
        const playerList = userTracked.join(', ');
        await interaction.reply({
            content: `You are currently tracking: ${playerList}`,
            ephemeral: true
        });
    }
}
