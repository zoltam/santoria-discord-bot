import { EmbedBuilder } from 'discord.js';
import { getLowRepTrackingStatus, toggleLowRepTracking } from '../trackers.js';

export const data = {
    name: 'lowreptrack',
    description: 'Toggles tracking for low reputation players.',
};

export async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.user.id;
    const newStatus = toggleLowRepTracking(userId);
    const statusMessage = newStatus ? 'enabled' : 'disabled';

    const embed = new EmbedBuilder()
        .setColor(newStatus ? 0x00ff00 : 0xff0000) // Green for enabled, Red for disabled
        .setDescription(`Low reputation player tracking has been **${statusMessage}**.`);

    await interaction.editReply({ embeds: [embed] });
}
