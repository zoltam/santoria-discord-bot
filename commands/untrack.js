import { SlashCommandBuilder } from 'discord.js';
import { removeTracker, getTrackedPlayers } from '../trackers.js';

export const data = new SlashCommandBuilder()
    .setName('untrack')
    .setDescription('Stop tracking a player')
    .addStringOption(option =>
        option.setName('player')
            .setDescription('Minecraft username to stop tracking')
            .setRequired(true)
            .setAutocomplete(true))
    .setDMPermission(true);

export async function execute(interaction) {
    const playerName = interaction.options.getString('player');
    const userId = interaction.user.id;

    const success = removeTracker(playerName.toLowerCase(), userId);
    
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
        
        for (const [_, data] of trackedPlayers) {
            if (data?.trackedBy?.has(userId) && data.originalUsername) {
                tracked.push(data.originalUsername);
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
