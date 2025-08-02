import { EmbedBuilder } from 'discord.js';
import { getKillTrackingStatus, toggleKillTracking } from '../trackers.js';

export const data = {
    name: 'togglekilltracker',
    description: 'Toggles tracking for player kills.',
};

export async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.user.id;
    const newStatus = toggleKillTracking(userId);
    const statusMessage = newStatus ? 'enabled' : 'disabled';

    const embed = new EmbedBuilder()
        .setColor(newStatus ? 0x00ff00 : 0xff0000) // Green for enabled, Red for disabled
        .setDescription(`Kill tracking has been **${statusMessage}**.`);

    await interaction.editReply({ embeds: [embed] });
}
