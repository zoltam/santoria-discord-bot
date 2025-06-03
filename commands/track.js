import { SlashCommandBuilder } from 'discord.js';
import { fetchOnlinePlayers } from '../utils.js';
import { addTracker } from '../trackers.js';

export const data = new SlashCommandBuilder()
    .setName('track')
    .setDescription('Track a player')
    .addStringOption(option =>
        option.setName('player')
            .setDescription('Minecraft username')
            .setRequired(true))
    .setDMPermission(true);

export async function execute(interaction) {
    const playerName = interaction.options.getString('player');
    const userId = interaction.user.id;
    const onlinePlayers = await fetchOnlinePlayers();
    const player = onlinePlayers.find(p => p.name.toLowerCase() === playerName.toLowerCase());
    
    addTracker(
        playerName, // Pass original casing for originalUsername
        userId,
        !!player,
        player?.world || null
    );
    
    await interaction.reply({
        content: `Now tracking ${playerName}. You'll get notifications!`,
        ephemeral: true
    });
}
